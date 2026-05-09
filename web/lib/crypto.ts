import { timingSafeEqual } from 'node:crypto'

/**
 * Compare deux strings en temps constant. Renvoie false si les longueurs
 * diffèrent — important pour ne pas leaker la longueur du secret comparé.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  return timingSafeEqual(aBuf, bBuf)
}

/**
 * Délai aléatoire (jitter) pour atténuer les timing attacks sur les Server
 * Actions (notamment /access). Utilisé en complément de constantTimeEqual.
 */
export function randomDelayMs(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
