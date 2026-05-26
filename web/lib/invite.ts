import { createHash, timingSafeEqual } from 'node:crypto'

// Expiry du lien global /invite/[slug]. Editable via env var INVITE_EXPIRES_AT
// (ISO 8601, e.g. "2026-08-31T23:59:59+02:00") pour rotation post-mariage sans
// redeploy. Fallback : ~3 mois après le mariage (2026-08-31 Paris).
const FALLBACK_EXPIRES_AT = '2026-08-31T23:59:59+02:00'

function resolveExpiresAtMs(): number {
  const raw = process.env.INVITE_EXPIRES_AT
  if (raw) {
    const parsed = new Date(raw).getTime()
    if (Number.isFinite(parsed)) return parsed
    console.warn('[invite] INVITE_EXPIRES_AT invalide, fallback', { raw })
  }
  return new Date(FALLBACK_EXPIRES_AT).getTime()
}

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
  if (Date.now() > resolveExpiresAtMs()) return 'expired'
  return 'ok'
}

export function getInviteExpiresAtISO(): string {
  return new Date(resolveExpiresAtMs()).toISOString()
}
