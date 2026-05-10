'use server'

import { revalidatePath } from 'next/cache'
import { quizQuestionSchema } from '@/lib/validators'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'
import { checkRateLimit } from '@/lib/rate-limit'

export async function submitQuizz(formData: FormData): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const guest = await getCurrentGuest()
  if (!guest) return { ok: false, error: 'Session expirée. Reviens via ton lien.' }

  const rawOptions = formData.getAll('option').map((v) => String(v))
  const parsed = quizQuestionSchema.safeParse({
    question: formData.get('question'),
    options: rawOptions,
    correct_index: formData.get('correct_index'),
  })
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message
    return { ok: false, error: firstIssue ?? 'Vérifie les champs.' }
  }

  let ipHash = 'unknown'
  try {
    ipHash = await getClientIPHash()
  } catch {}

  const rl = await checkRateLimit(`quizz:${ipHash}`, 5, 3600)
  if (!rl.allowed) {
    return { ok: false, error: "T'en as déjà mis pas mal. Reviens dans une heure." }
  }

  const service = getServiceClient()
  const { error } = await service.from('quizz').insert({
    guest_id: guest.id,
    uploader_name: guest.full_name ?? guest.email.split('@')[0],
    question_text: parsed.data.question,
    options: parsed.data.options,
    correct_index: parsed.data.correct_index,
    ip_hash: ipHash,
  })

  if (error) {
    console.error('[quizz]', error)
    return { ok: false, error: 'On a un souci côté serveur. Réessaie dans une minute.' }
  }

  revalidatePath('/quizz')
  return { ok: true }
}
