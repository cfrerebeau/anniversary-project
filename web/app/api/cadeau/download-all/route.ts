import { NextResponse, type NextRequest } from 'next/server'
import { getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'
import { checkRateLimit } from '@/lib/rate-limit'
import { PHOTO_BUCKETS, type PhotoBucketKey } from '@/lib/photo-buckets'
import { inspectCadeauAccess, CadeauDenied } from '@/lib/cadeau-auth'
import {
  makeUniqueFilename,
  streamZipResponse,
  type ZipEntryInput,
} from '@/lib/zip-photos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_FILES = 1000
const MAX_BYTES = 8 * 1024 ** 3 // 8 GB
const SIGN_TTL_S = 5 * 60

const FOLDER_PREFIX: Record<string, string> = {
  [PHOTO_BUCKETS.souvenirs.id]: 'avant-le-mariage',
  [PHOTO_BUCKETS.event.id]: 'pendant-le-mariage',
}

const ZIP_NAME_BY_BUCKET: Record<PhotoBucketKey, string> = {
  souvenirs: 'cadeau-avant-le-mariage.zip',
  event: 'cadeau-pendant-la-fete.zip',
}
const ZIP_NAME_COMBINED = 'cadeau-brice-alix.zip'

type BucketParseResult =
  | { kind: 'absent' }
  | { kind: 'valid'; bucket: PhotoBucketKey }
  | { kind: 'invalid' }

function parseBucketParam(raw: string | null): BucketParseResult {
  if (raw == null) return { kind: 'absent' }
  if (raw === 'souvenirs' || raw === 'event') {
    return { kind: 'valid', bucket: raw }
  }
  return { kind: 'invalid' }
}

export async function GET(request: NextRequest) {
  try {
    // L'API ne fait jamais cookie-swap — c'est le rôle de la page. Cookie OU admin.
    await inspectCadeauAccess(undefined, 'api')
  } catch (err) {
    if (err instanceof CadeauDenied) {
      return new Response('unauthorized', { status: 401 })
    }
    throw err
  }

  let ipHash = 'unknown'
  try {
    ipHash = await getClientIPHash()
  } catch {}

  const rl = await checkRateLimit(`cadeau-zip:${ipHash}`, 5, 3600)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const url = new URL(request.url)
  const parsed = parseBucketParam(url.searchParams.get('bucket'))
  if (parsed.kind === 'invalid') {
    return NextResponse.json({ error: 'invalid_bucket' }, { status: 400 })
  }
  const bucketKey = parsed.kind === 'valid' ? parsed.bucket : null

  const service = getServiceClient()
  let query = service
    .from('photos')
    .select('id, storage_bucket, storage_path, caption, content_type, size_bytes, created_at')
    .order('storage_bucket', { ascending: true })
    .order('created_at', { ascending: true })
  if (bucketKey) {
    query = query.eq('storage_bucket', PHOTO_BUCKETS[bucketKey].id)
  }
  const { data: rows, error } = await query

  if (error) {
    console.error('[cadeau/zip:query]', error)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  const photos = rows ?? []
  const totalBytes = photos.reduce(
    (acc, p) => acc + (typeof p.size_bytes === 'number' ? p.size_bytes : 0),
    0,
  )

  const used = new Set<string>()
  const entries: ZipEntryInput[] = photos.map((p, idx) => {
    // Folder seulement en mode combined ; sinon un seul bucket → flat.
    const folder = bucketKey ? undefined : FOLDER_PREFIX[p.storage_bucket]
    return {
      filename: makeUniqueFilename(p, idx, used, folder),
      date: new Date(p.created_at),
      openStream: async (signal) => {
        const { data: signed, error: signErr } = await service.storage
          .from(p.storage_bucket)
          .createSignedUrl(p.storage_path, SIGN_TTL_S)
        if (signErr || !signed) throw new Error(`sign:${p.id}`)
        const upstream = await fetch(signed.signedUrl, {
          signal,
          cache: 'no-store',
        })
        if (!upstream.ok || !upstream.body) {
          throw new Error(`fetch:${upstream.status}:${p.id}`)
        }
        return { body: upstream.body }
      },
    }
  })

  return streamZipResponse({
    entries,
    zipName: bucketKey ? ZIP_NAME_BY_BUCKET[bucketKey] : ZIP_NAME_COMBINED,
    budget: { maxFiles: MAX_FILES, maxBytesEstimate: MAX_BYTES },
    totalBytesEstimate: totalBytes,
    signal: request.signal,
  })
}
