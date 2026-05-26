import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'
import { checkRateLimit } from '@/lib/rate-limit'
import { PHOTO_BUCKETS, type PhotoBucketKey } from '@/lib/photo-buckets'
import {
  makeUniqueFilename,
  streamZipResponse,
  type ZipEntryInput,
} from '@/lib/zip-photos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const querySchema = z.object({
  bucket: z.enum(['souvenirs', 'event']),
})

const ZIP_FILENAME: Record<PhotoBucketKey, string> = {
  souvenirs: 'vieilles-photos.zip',
  event: 'photos-de-la-fete.zip',
}

const MAX_FILES = 500
const MAX_BYTES = 5 * 1024 ** 3 // 5 GB
const SIGN_TTL_S = 5 * 60 // 5 min — chaque entrée signe juste avant fetch

export async function GET(request: NextRequest) {
  const guest = await getCurrentGuest()
  if (!guest) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const bucketParam = url.searchParams.get('bucket')
  const parsed = querySchema.safeParse({ bucket: bucketParam })
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_bucket' }, { status: 400 })
  }
  const bucketKey: PhotoBucketKey = parsed.data.bucket
  const bucketConf = PHOTO_BUCKETS[bucketKey]

  let ipHash = 'unknown'
  try {
    ipHash = await getClientIPHash()
  } catch {}

  // 5/h par IP et 5/h par guest — éviter qu'un guest derrière un NAT partagé
  // soit bridé par un voisin tout en bornant l'abus d'un guest unique.
  const rlIp = await checkRateLimit(`photos-zip:${ipHash}`, 5, 3600)
  if (!rlIp.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const rlGuest = await checkRateLimit(`photos-zip-guest:${guest.id}`, 5, 3600)
  if (!rlGuest.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const service = getServiceClient()
  const { data: rows, error } = await service
    .from('photos')
    .select('id, storage_bucket, storage_path, caption, content_type, size_bytes, created_at')
    .eq('storage_bucket', bucketConf.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[photos/zip:query]', error)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  const photos = rows ?? []

  const totalBytes = photos.reduce(
    (acc, p) => acc + (typeof p.size_bytes === 'number' ? p.size_bytes : 0),
    0,
  )

  const used = new Set<string>()
  const entries: ZipEntryInput[] = photos.map((p, idx) => ({
    filename: makeUniqueFilename(p, idx, used),
    date: new Date(p.created_at),
    openStream: async (signal) => {
      const { data: signed, error: signErr } = await service.storage
        .from(p.storage_bucket)
        .createSignedUrl(p.storage_path, SIGN_TTL_S)
      if (signErr || !signed) {
        throw new Error(`sign:${p.id}`)
      }
      const upstream = await fetch(signed.signedUrl, {
        signal,
        cache: 'no-store',
      })
      if (!upstream.ok || !upstream.body) {
        throw new Error(`fetch:${upstream.status}:${p.id}`)
      }
      return { body: upstream.body }
    },
  }))

  return streamZipResponse({
    entries,
    zipName: ZIP_FILENAME[bucketKey],
    budget: { maxFiles: MAX_FILES, maxBytesEstimate: MAX_BYTES },
    totalBytesEstimate: totalBytes,
    signal: request.signal,
  })
}
