import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase/server'
import { inspectCadeauAccess, CadeauDenied } from '@/lib/cadeau-auth'

const SIGNED_URL_TTL = 60 * 30 // 30 min

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
})

/**
 * Sign d'URLs photos pour le diaporama de /cadeau. Auth = cookie cadeau OU
 * admin (le helper redirige sur token via la page, donc l'API n'accepte que
 * les sessions déjà établies — pas de query token ici).
 */
export async function POST(request: NextRequest) {
  try {
    await inspectCadeauAccess(undefined, 'api')
  } catch (err) {
    if (err instanceof CadeauDenied) {
      return new Response('unauthorized', { status: 401 })
    }
    throw err
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
    console.error('[cadeau/photos/sign]', error)
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
      console.error('[cadeau/photos/sign:bucket]', signErr, { bucket })
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
