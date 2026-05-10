import { createHash, timingSafeEqual } from 'node:crypto'

// Le lien global expire à la fin du 25 mai 2026 (heure de Paris). Au-delà,
// l'inscription via /invite/[slug] est fermée — il reste /access (lien magique
// par email) pour les invités déjà connus.
const INVITE_EXPIRES_AT_MS = new Date('2026-05-25T23:59:59+02:00').getTime()
// Cap arbitraire pour éviter qu'un client envoie un slug géant (DoS Buffer).
const MAX_SLUG_INPUT = 200

export type InviteCheck = 'ok' | 'wrong_slug' | 'expired'

export function checkInviteSlug(input: string): InviteCheck {
  const expected = process.env.GLOBAL_INVITE_SLUG
  if (!expected || !input || input.length > MAX_SLUG_INPUT) return 'wrong_slug'
  // Hash both to fixed-length 32-byte buffers : `timingSafeEqual` ne peut alors
  // plus court-circuiter sur la longueur, et on ne fuit pas la longueur du slug.
  const a = createHash('sha256').update(input).digest()
  const b = createHash('sha256').update(expected).digest()
  if (!timingSafeEqual(a, b)) return 'wrong_slug'
  if (Date.now() > INVITE_EXPIRES_AT_MS) return 'expired'
  return 'ok'
}
