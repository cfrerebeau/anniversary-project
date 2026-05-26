import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { constantTimeEqual, randomDelayMs, sleep } from '@/lib/crypto'
import { getCurrentGuest, type Guest } from '@/lib/auth'
import { getClientIPHash } from '@/lib/ip'
import { checkRateLimit } from '@/lib/rate-limit'

const TOKEN_RE = /^[a-f0-9]{64}$/
const COOKIE_NAME = 'cadeau_auth'
const COOKIE_VERSION = '1'
const COOKIE_MAX_AGE_S = 30 * 24 * 3600 // 30 jours
const RL_BUCKET_PREFIX = 'cadeau-token'
const RL_LIMIT = 10
const RL_WINDOW_S = 600

export type CadeauAuth =
  | { kind: 'admin'; guest: Guest }
  | { kind: 'cookie' }

export class CadeauDenied extends Error {
  constructor(public reason: 'missing' | 'invalid' | 'rate_limited' | 'not_configured') {
    super(reason)
  }
}

function getCookieSecret(): string | null {
  const s = process.env.SESSION_COOKIE_SECRET
  if (!s || s.length < 16) return null
  return s
}

/**
 * Cookie cadeau au format `<ver>.<hmac>`. Le HMAC est calculé sur la version
 * uniquement (la version sert juste à invalider en masse en cas de rotation
 * future en bumpant COOKIE_VERSION + le secret). Pas de payload utilisateur :
 * la connaissance du HMAC suffit, ce qui est exactement le contrat d'un
 * bearer signé impossible à forger sans SESSION_COOKIE_SECRET.
 */
function issueCookieValue(): string {
  const secret = getCookieSecret()
  if (!secret) throw new Error('SESSION_COOKIE_SECRET not configured (min 16 chars)')
  const mac = createHmac('sha256', secret).update(`cadeau:${COOKIE_VERSION}`).digest('hex')
  return `${COOKIE_VERSION}.${mac}`
}

function verifyCookieValue(value: string | undefined): boolean {
  if (!value) return false
  const secret = getCookieSecret()
  if (!secret) return false
  const idx = value.indexOf('.')
  if (idx <= 0) return false
  const ver = value.slice(0, idx)
  if (ver !== COOKIE_VERSION) return false
  const mac = value.slice(idx + 1)
  if (!/^[a-f0-9]{64}$/.test(mac)) return false
  const expected = createHmac('sha256', secret).update(`cadeau:${COOKIE_VERSION}`).digest('hex')
  const a = Buffer.from(mac, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function compareToken(provided: string): Promise<boolean> {
  if (!TOKEN_RE.test(provided)) return false
  const expected = process.env.BENEFICIARY_ACCESS_TOKEN
  if (!expected || !TOKEN_RE.test(expected)) return false
  await sleep(randomDelayMs(50, 200))
  return constantTimeEqual(provided, expected)
}

async function recordAndCheckBadToken(): Promise<boolean> {
  // Renvoie `true` si on est encore sous la limite, `false` si bloqué.
  try {
    const ipHash = await getClientIPHash()
    const rl = await checkRateLimit(
      `${RL_BUCKET_PREFIX}:${ipHash}`,
      RL_LIMIT,
      RL_WINDOW_S,
    )
    return rl.allowed
  } catch (err) {
    console.error('[cadeau:rl-failed]', err)
    return true // best-effort : préfère le faux negatif au faux positif
  }
}

export type RequireCadeauResult =
  | { kind: 'admin' | 'cookie' }
  | { kind: 'set-cookie-and-redirect'; redirectTo: string }

/**
 * Politique d'accès `/cadeau`, dans l'ordre :
 *   1. Cookie cadeau_auth signé valide          → access (kind: 'cookie').
 *   2. Admin session (is_admin)                  → access (kind: 'admin').
 *   3. Query token shape-valide ET match         → set-cookie-and-redirect.
 *   4. Query token présent mais bad              → RL + deny (page redirect /, api 401).
 *   5. Pas de token et pas authentifié           → deny silencieux.
 *
 * L'admin check passe AVANT le token compare pour qu'un admin qui ouvre par
 * mégarde `/cadeau?token=WRONG` n'obtienne pas un redirect contre-intuitif.
 */
export async function inspectCadeauAccess(
  token: string | undefined,
  mode: 'page' | 'api',
): Promise<RequireCadeauResult> {
  const cookieStore = await cookies()
  const cookieVal = cookieStore.get(COOKIE_NAME)?.value
  if (verifyCookieValue(cookieVal)) {
    return { kind: 'cookie' }
  }

  // Admin via session — avant le token compare pour éviter qu'un admin tapant
  // un token erroné se retrouve en deny.
  const guest = await getCurrentGuest()
  if (guest?.is_admin) {
    return { kind: 'admin' }
  }

  if (token != null) {
    const ok = await compareToken(token)
    if (ok) {
      return { kind: 'set-cookie-and-redirect', redirectTo: '/cadeau' }
    }
    const stillAllowed = await recordAndCheckBadToken()
    if (mode === 'page') redirect('/')
    throw new CadeauDenied(stillAllowed ? 'invalid' : 'rate_limited')
  }

  // Pas de token, pas admin, pas de cookie.
  if (mode === 'page') {
    redirect('/')
  }
  // API : RL pour pénaliser le scan d'endpoint.
  const stillAllowed = await recordAndCheckBadToken()
  throw new CadeauDenied(stillAllowed ? 'missing' : 'rate_limited')
}

/**
 * Pose le cookie signé et redirige. Path '/' parce que les routes API
 * `/api/cadeau/*` doivent recevoir le cookie aussi.
 */
export async function applyCookieAndRedirect(redirectTo: string): Promise<never> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, issueCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_S,
  })
  redirect(redirectTo)
}

export { COOKIE_NAME as CADEAU_COOKIE_NAME }
