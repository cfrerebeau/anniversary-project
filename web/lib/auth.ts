import { redirect } from 'next/navigation'
import { getServerClient, getServiceClient } from '@/lib/supabase/server'

export type Guest = {
  id: string
  email: string
  full_name: string | null
  is_blocked: boolean
  is_admin: boolean
  first_visit_at: string | null
  last_visit_at: string | null
}

/**
 * Renvoie le guest correspondant à la session active, ou null si pas de
 * session ou si l'email ne match aucun row dans `guests` (cas où la session
 * Supabase existe mais l'invité a été retiré de la liste).
 */
export async function getCurrentGuest(): Promise<Guest | null> {
  const supabase = await getServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user?.email) return null

  const service = getServiceClient()
  const { data: guest } = await service
    .from('guests')
    .select('id, email, full_name, is_blocked, is_admin, first_visit_at, last_visit_at')
    .eq('email', data.user.email.toLowerCase())
    .maybeSingle()

  if (!guest || guest.is_blocked) return null

  // Met à jour first_visit_at / last_visit_at en best-effort (fire & forget).
  // Guard 1h : pas la peine d'écrire à chaque page load — un guest qui
  // navigue génère sinon un UPDATE par RSC.
  const lastVisitMs = guest.last_visit_at ? new Date(guest.last_visit_at).getTime() : 0
  const oneHourAgo = Date.now() - 3600_000
  if (!guest.first_visit_at || lastVisitMs < oneHourAgo) {
    void service
      .from('guests')
      .update({
        first_visit_at: guest.first_visit_at ?? new Date().toISOString(),
        last_visit_at: new Date().toISOString(),
      })
      .eq('id', guest.id)
  }

  return guest as Guest
}

/**
 * Redirige vers /access si pas de guest valide. Renvoie le guest sinon.
 */
export async function requireGuest(): Promise<Guest> {
  const guest = await getCurrentGuest()
  if (!guest) redirect('/access')
  return guest
}

/**
 * Comme requireGuest, mais redirige vers `/` si le guest n'est pas admin.
 * Utilisé pour protéger toutes les pages sous `/admin` et la server action
 * d'ajout d'invité.
 */
export async function requireAdmin(): Promise<Guest> {
  const guest = await getCurrentGuest()
  if (!guest) redirect('/access')
  if (!guest.is_admin) redirect('/')
  return guest
}

export function getFirstName(guest: Guest): string {
  if (!guest.full_name) return guest.email.split('@')[0]
  return guest.full_name.split(' ')[0]
}
