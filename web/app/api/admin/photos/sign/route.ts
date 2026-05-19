import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'

const SIGNED_URL_TTL = 60 * 30 // garde le même TTL que la page admin

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
})

export async function POST(request: NextRequest) {
  const guest = await getCurrentGuest()
  if (!guest) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!guest.is_admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const service = getServiceClient()
  // On résout (bucket, path) côté serveur à partir des IDs uniquement —
  // jamais accepter de chemin brut envoyé par le client.
  const { data: rows, error } = await service
    .from('photos')
    .select('id, storage_bucket, storage_path')
    .in('id', parsed.data.ids)

  if (error) {
    console.error('[admin/photos/sign]', error)
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
    const { data: signed } = await service.storage
      .from(bucket)
      .createSignedUrls(
        items.map((it) => it.storage_path),
        SIGNED_URL_TTL,
      )
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
