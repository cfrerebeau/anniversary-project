import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

const SIGNED_URL_TTL = 60 * 30 // 30 min — même TTL que la grille rendue.

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
})

/**
 * Sign de URLs photos accessible aux guests authentifiés. Utilisé par le
 * diaporama sur /photos pour rafraîchir les URLs juste avant expiration.
 *
 * Pas de filtre `guest_id` : depuis post-mariage, tout le monde voit les
 * photos de tout le monde. Les IDs ne sont pas secrets — pas un oracle utile.
 */
export async function POST(request: NextRequest) {
  const guest = await getCurrentGuest()
  if (!guest) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Borne le scan d'IDs : 600 reqs/h/guest = ~10/min, large pour un diaporama
  // qui refresh toutes les ~25 min mais trop pour scripter du scraping.
  const rl = await checkRateLimit(`photos-sign:${guest.id}`, 600, 3600)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const service = getServiceClient()
  const { data: rows, error } = await service
    .from('photos')
    .select('id, storage_bucket, storage_path')
    .in('id', parsed.data.ids)

  if (error) {
    console.error('[photos/sign]', error)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  type Row = { id: string; storage_bucket: string; storage_path: string }
  const photos = (rows ?? []) as Row[]

  const byBucket = new Map<string, Row[]>()
  for (const p of photos) {
    const arr = byBucket.get(p.storage_bucket) ?? []
    arr.push(p)
    byBucket.set(p.storage_bucket, arr)
  }

  const issuedAt = Date.now()
  const urls: Record<string, { url: string; issuedAt: number }> = {}

  for (const [bucket, items] of byBucket) {
    const { data: signed, error: signErr } = await service.storage
      .from(bucket)
      .createSignedUrls(
        items.map((it) => it.storage_path),
        SIGNED_URL_TTL,
      )
    if (signErr) {
      console.error('[photos/sign:bucket]', signErr, { bucket })
    }
    const pathToId = new Map(items.map((it) => [it.storage_path, it.id]))
    for (const row of signed ?? []) {
      if (row.signedUrl && row.path) {
        const id = pathToId.get(row.path)
        if (id) urls[id] = { url: row.signedUrl, issuedAt }
      }
    }
  }

  return NextResponse.json({ urls })
}
