import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

const schema = z.object({
  id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const guest = await getCurrentGuest()
  if (!guest) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const rl = await checkRateLimit(`photo-delete:${guest.id}`, 60, 3600)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const service = getServiceClient()

  // Ownership-scoped lookup : un guest ne peut viser que ses propres photos.
  const { data: row, error: selErr } = await service
    .from('photos')
    .select('id, storage_bucket, storage_path')
    .eq('id', parsed.data.id)
    .eq('guest_id', guest.id)
    .maybeSingle()

  if (selErr) {
    console.error('[photos/delete:select]', selErr)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  if (!row) {
    // Pas trouvée OU pas à ce guest → même réponse pour ne pas leak.
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // DB-first : si on supprimait Storage d'abord et que la DB échouait, on
  // se retrouverait avec une row pointant vers un fichier disparu (carte
  // cassée, URL signée en erreur). Dans le sens DB-first, le pire cas est un
  // fichier orphelin dans le bucket — détectable et nettoyable hors-ligne.
  const { error: delErr } = await service
    .from('photos')
    .delete()
    .eq('id', row.id)
    .eq('guest_id', guest.id)

  if (delErr) {
    console.error('[photos/delete:db]', delErr)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }

  // Cleanup best-effort. remove() est idempotent côté Supabase Storage. Si
  // ça fail on log mais on rend 200 : la photo n'apparaît plus dans l'UI.
  const { error: stErr } = await service.storage
    .from(row.storage_bucket)
    .remove([row.storage_path])
  if (stErr) {
    console.error('[photos/delete:storage-orphan]', stErr, {
      bucket: row.storage_bucket,
      path: row.storage_path,
    })
  }

  return NextResponse.json({ ok: true })
}
