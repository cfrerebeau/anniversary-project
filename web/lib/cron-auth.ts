import { type NextRequest } from 'next/server'
import { constantTimeEqual } from '@/lib/crypto'

/**
 * Vérifie que la requête vient bien de Vercel Cron en comparant le bearer
 * token avec CRON_SECRET. À appeler en haut de chaque /api/cron/* handler.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = request.headers.get('authorization') ?? ''
  const provided = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : ''
  if (!provided) return false
  return constantTimeEqual(provided, expected)
}
