'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'

const schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email(),
  full_name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional(),
})

export type AddGuestResult = {
  status: 'ok' | 'invalid' | 'duplicate' | 'error'
  message: string
}

/**
 * Insère un nouvel invité dans `guests`. L'admin communique ensuite à
 * l'invité d'aller demander son lien magique via /access — pas d'email
 * envoyé automatiquement (on garde l'inscription manuelle via le script
 * `pnpm invite` pour les envois en masse).
 */
export async function addGuest(formData: FormData): Promise<AddGuestResult> {
  await requireAdmin()

  const parsed = schema.safeParse({
    email: formData.get('email'),
    full_name: formData.get('full_name') || undefined,
  })
  if (!parsed.success) {
    return { status: 'invalid', message: 'Email invalide.' }
  }

  const service = getServiceClient()
  const { error } = await service.from('guests').insert({
    email: parsed.data.email,
    full_name: parsed.data.full_name ?? null,
    is_blocked: false,
  })
  if (error) {
    if (error.code === '23505') {
      return { status: 'duplicate', message: 'Cet email est déjà invité.' }
    }
    console.error('[admin/add-guest] insert', error)
    return { status: 'error', message: "Erreur à l'ajout — voir les logs serveur." }
  }

  // L'app /access utilise `signInWithOtp({ shouldCreateUser: false })` pour
  // ne jamais laisser n'importe qui s'inscrire. Pour qu'un invité ajouté à la
  // main puisse ensuite recevoir son lien, il faut donc que l'utilisateur
  // existe déjà côté `auth.users`. On le crée ici de manière idempotente, sans
  // envoyer de mail (`email_confirm: true` court-circuite l'email de
  // confirmation par défaut). Si l'utilisateur existe déjà (ex: ré-import),
  // on ignore l'erreur.
  const { error: authErr } = await service.auth.admin.createUser({
    email: parsed.data.email,
    email_confirm: true,
  })
  if (authErr && !/already (been )?registered|exists/i.test(authErr.message)) {
    console.error('[admin/add-guest] auth.admin.createUser', authErr)
    // L'invité est dans `guests` mais pas dans `auth.users` — il faudra
    // intervenir à la main. On informe l'admin pour qu'il sache.
    return {
      status: 'error',
      message: "Invité ajouté mais création auth échouée — voir logs.",
    }
  }

  revalidatePath('/admin/guests')
  revalidatePath('/admin')
  return {
    status: 'ok',
    message: `${parsed.data.email} ajouté. Dis-lui d'aller sur /access pour recevoir son lien.`,
  }
}
