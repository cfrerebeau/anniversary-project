'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { getServiceClient } from '@/lib/supabase/server'

const schema = z.object({
  guestId: z.string().uuid(),
  full_name: z.string().trim().max(120).nullable(),
})

export type UpdateGuestNameResult = {
  status: 'ok' | 'invalid' | 'error'
  message: string
}

/**
 * Met à jour `full_name` pour un invité. Vide => NULL (auth.ts retombe alors
 * sur la partie locale de l'email pour l'affichage). Utilisé pour corriger à
 * la main les noms importés du CSV initial.
 */
export async function updateGuestName(formData: FormData): Promise<UpdateGuestNameResult> {
  await requireAdmin()

  const rawName = formData.get('full_name')
  const parsed = schema.safeParse({
    guestId: formData.get('guestId'),
    full_name:
      typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : null,
  })
  if (!parsed.success) {
    return { status: 'invalid', message: 'Entrée invalide.' }
  }

  const service = getServiceClient()
  const { error } = await service
    .from('guests')
    .update({ full_name: parsed.data.full_name })
    .eq('id', parsed.data.guestId)
  if (error) {
    console.error('[admin/update-guest] update', error)
    return { status: 'error', message: 'Erreur à la mise à jour — voir logs.' }
  }

  revalidatePath('/admin/guests')
  return { status: 'ok', message: 'Enregistré.' }
}
