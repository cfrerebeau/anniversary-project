import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PhotoBucketKey } from '@/lib/photo-buckets'

/**
 * HMAC stateless qui binde un upload (sign-upload) à son process (process).
 * Empêche un client de signer dans le bucket A et d'insérer ensuite une row
 * pour le bucket B. Stateless = pas de DB pending-upload (overkill ici).
 *
 * Le secret est `SESSION_COOKIE_SECRET` (déjà utilisé pour Supabase SSR) ; on
 * ne réutilise pas l'IP_HASH_SALT pour ne pas mélanger les domaines.
 */
const TTL_MS = 10 * 60 * 1000 // 10 min — large pour un upload lent + process

type Payload = {
  guestId: string
  bucket: PhotoBucketKey
  path: string
}

function getSecret(): string {
  const s = process.env.SESSION_COOKIE_SECRET
  if (!s || s.length < 16) {
    throw new Error('SESSION_COOKIE_SECRET not configured (min 16 chars)')
  }
  return s
}

function compute(payload: Payload, exp: number): string {
  const msg = `${payload.guestId}|${payload.bucket}|${payload.path}|${exp}`
  return createHmac('sha256', getSecret()).update(msg).digest('hex')
}

export function issueUploadNonce(payload: Payload): { nonce: string; exp: number } {
  const exp = Date.now() + TTL_MS
  return { nonce: compute(payload, exp), exp }
}

export function verifyUploadNonce(
  payload: Payload,
  nonce: string,
  exp: number,
): boolean {
  if (!Number.isFinite(exp) || Date.now() > exp) return false
  if (typeof nonce !== 'string' || nonce.length !== 64) return false
  const expected = compute(payload, exp)
  // Hex strings always same length, on peut comparer directement.
  const a = Buffer.from(nonce, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
