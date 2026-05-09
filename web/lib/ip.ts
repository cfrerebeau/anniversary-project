import { createHash } from 'node:crypto'
import { headers } from 'next/headers'

export function hashIP(ip: string | null | undefined): string {
  const salt = process.env.IP_HASH_SALT ?? ''
  if (!salt) {
    throw new Error('IP_HASH_SALT not configured')
  }
  const value = ip?.trim() || 'unknown'
  return createHash('sha256').update(`${salt}:${value}`).digest('hex')
}

/**
 * Lit l'IP du request depuis les headers Vercel/Cloudflare standard.
 * Renvoie un hash sel + sha256 — jamais l'IP en clair.
 */
export async function getClientIPHash(): Promise<string> {
  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    null
  return hashIP(ip)
}
