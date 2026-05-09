'use server'

import { revalidatePath } from 'next/cache'
import { cagnotteMessageSchema } from '@/lib/validators'
import { getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'
import { checkRateLimit } from '@/lib/rate-limit'

export async function submitCagnotteMessage(formData: FormData): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const parsed = cagnotteMessageSchema.safeParse({
    display_name: formData.get('display_name'),
    amount_cents: formData.get('amount_cents'),
    message: formData.get('message') ?? '',
  })
  if (!parsed.success) {
    return { ok: false, error: 'Vérifie les champs.' }
  }

  let ipHash = 'unknown'
  try {
    ipHash = await getClientIPHash()
  } catch {}

  const rl = await checkRateLimit(`cagnotte:${ipHash}`, 10, 3600)
  if (!rl.allowed) {
    return { ok: false, error: 'Tu envoies un peu vite. Reviens dans une heure.' }
  }

  const service = getServiceClient()
  const { error } = await service.from('cagnotte_messages').insert({
    display_name: parsed.data.display_name,
    amount_cents: parsed.data.amount_cents ?? null,
    message: parsed.data.message,
    ip_hash: ipHash,
  })

  if (error) {
    console.error('[cagnotte-message]', error)
    return { ok: false, error: 'On a un souci côté serveur. Réessaie dans une minute.' }
  }

  revalidatePath('/cagnotte')
  return { ok: true }
}
