import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

const schema = z.object({
  id: z.string().uuid(),
  caption: z.string().trim().max(280),
})

export async function POST(request: NextRequest) {
  const guest = await getCurrentGuest()
  if (!guest) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const rl = await checkRateLimit(`caption:${guest.id}`, 60, 3600)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const service = getServiceClient()
  const { data, error } = await service
    .from('photos')
    .update({ caption: parsed.data.caption })
    .eq('id', parsed.data.id)
    .eq('guest_id', guest.id) // un guest ne peut éditer que ses propres photos
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[photos/update-caption]', error)
    return NextResponse.json({ error: 'db_failed' }, { status: 500 })
  }
  if (!data) {
    // Pas trouvée OU pas à ce guest → même réponse pour ne pas leak. Évite
    // aussi le faux positif où le client croit avoir sauvé alors que la
    // photo a été supprimée entre-temps.
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
