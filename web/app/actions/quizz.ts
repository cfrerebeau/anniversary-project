'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { quizQuestionSchema } from '@/lib/validators'
import { getCurrentGuest } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'
import { getClientIPHash } from '@/lib/ip'
import { checkRateLimit } from '@/lib/rate-limit'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function submitQuizz(formData: FormData): Promise<ActionResult> {
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
  revalidatePath('/admin/quizz')
  return { ok: true }
}

const idSchema = z.string().uuid()

const updateSchema = quizQuestionSchema.and(z.object({ id: idSchema }))

export async function updateQuizz(formData: FormData): Promise<ActionResult> {
  const guest = await getCurrentGuest()
  if (!guest) return { ok: false, error: 'Session expirée. Reviens via ton lien.' }

  const rawOptions = formData.getAll('option').map((v) => String(v))
  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    question: formData.get('question'),
    options: rawOptions,
    correct_index: formData.get('correct_index'),
  })
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message
    return { ok: false, error: firstIssue ?? 'Vérifie les champs.' }
  }

  if (!guest.is_admin) {
    const rl = await checkRateLimit(`quizz-update:${guest.id}`, 60, 3600)
    if (!rl.allowed) {
      return { ok: false, error: "T'as fait pas mal de modifs. Reviens dans une heure." }
    }
  }

  const service = getServiceClient()
  let q = service
    .from('quizz')
    .update({
      question_text: parsed.data.question,
      options: parsed.data.options,
      correct_index: parsed.data.correct_index,
    })
    .eq('id', parsed.data.id)
  if (!guest.is_admin) q = q.eq('guest_id', guest.id)

  const { data, error } = await q.select('id').maybeSingle()

  if (error) {
    console.error('[quizz/update]', error)
    return { ok: false, error: 'On a un souci côté serveur. Réessaie dans une minute.' }
  }
  if (!data) {
    return { ok: false, error: 'Question introuvable.' }
  }

  revalidatePath('/quizz')
  revalidatePath('/admin/quizz')
  return { ok: true }
}

const deleteSchema = z.object({ id: idSchema })

export async function deleteQuizz(formData: FormData): Promise<ActionResult> {
  const guest = await getCurrentGuest()
  if (!guest) return { ok: false, error: 'Session expirée. Reviens via ton lien.' }

  const parsed = deleteSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) {
    return { ok: false, error: 'Identifiant invalide.' }
  }

  if (!guest.is_admin) {
    const rl = await checkRateLimit(`quizz-delete:${guest.id}`, 60, 3600)
    if (!rl.allowed) {
      return { ok: false, error: "T'as fait pas mal de suppressions. Reviens dans une heure." }
    }
  }

  const service = getServiceClient()

  // Atomic : delete + select en un appel. data null = ligne pas trouvée ou
  // pas à ce guest (réponse 404 indifférenciée).
  let del = service.from('quizz').delete().eq('id', parsed.data.id)
  if (!guest.is_admin) del = del.eq('guest_id', guest.id)
  const { data: deleted, error: delErr } = await del.select('id').maybeSingle()

  if (delErr) {
    console.error('[quizz/delete]', delErr)
    return { ok: false, error: 'On a un souci côté serveur. Réessaie dans une minute.' }
  }
  if (!deleted) {
    return { ok: false, error: 'Question introuvable.' }
  }

  revalidatePath('/quizz')
  revalidatePath('/admin/quizz')
  return { ok: true }
}
