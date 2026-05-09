'use server'

import { revalidatePath } from 'next/cache'
import { anecdoteSchema } from '@/lib/validators'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'
import { checkRateLimit } from '@/lib/rate-limit'

export async function submitAnecdote(formData: FormData): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const guest = await getCurrentGuest()
  if (!guest) return { ok: false, error: 'Session expirée. Reviens via ton lien.' }

  const parsed = anecdoteSchema.safeParse({
    title: formData.get('title'),
    story: formData.get('story'),
    since: formData.get('since') || undefined,
  })
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message
    return { ok: false, error: firstIssue ?? 'Vérifie les champs.' }
  }

  let ipHash = 'unknown'
  try {
    ipHash = await getClientIPHash()
  } catch {}

  const rl = await checkRateLimit(`anecdote:${ipHash}`, 5, 3600)
  if (!rl.allowed) {
    return { ok: false, error: "T'en as déjà mis pas mal. Reviens dans une heure." }
  }

  const service = getServiceClient()
  const { error } = await service.from('anecdotes').insert({
    guest_id: guest.id,
    uploader_name: guest.full_name ?? guest.email.split('@')[0],
    title: parsed.data.title || null,
    story: parsed.data.story,
    since_relationship: parsed.data.since ?? null,
    ip_hash: ipHash,
  })

  if (error) {
    console.error('[anecdote]', error)
    return { ok: false, error: 'On a un souci côté serveur. Réessaie dans une minute.' }
  }

  revalidatePath('/anecdotes')
  return { ok: true }
}
