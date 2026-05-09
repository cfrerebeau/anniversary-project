import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * On mocke @/lib/supabase/server pour piloter le client Supabase et tester
 * la logique de fenêtre glissante sans toucher à la vraie DB.
 *
 * Le client mocké simule l'API supabase-js fluent : .from().select().eq().gte()
 * renvoie { count, data }. Et .from().insert() incrémente notre compteur.
 */
const insertedCount: { value: number; lastBucket: string | null } = {
  value: 0,
  lastBucket: null,
}

const fluentBuilder = (count: number) => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    head: () => builder,
    then: (resolve: (v: unknown) => void) => resolve({ count, error: null }),
  }
  return builder
}

vi.mock('@/lib/supabase/server', () => {
  return {
    getServiceClient: () => ({
      from: (_table: string) => ({
        select: () => fluentBuilder(insertedCount.value),
        insert: (row: { bucket: string }) => {
          insertedCount.value += 1
          insertedCount.lastBucket = row.bucket
          return Promise.resolve({ error: null })
        },
      }),
    }),
  }
})

describe('checkRateLimit', () => {
  beforeEach(() => {
    insertedCount.value = 0
    insertedCount.lastBucket = null
  })

  it('accepte sous la limite', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const r = await checkRateLimit('test:abc', 5, 60)
    expect(r.allowed).toBe(true)
    expect(insertedCount.value).toBe(1)
  })

  it('refuse à la limite', async () => {
    insertedCount.value = 5
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const r = await checkRateLimit('test:abc', 5, 60)
    expect(r.allowed).toBe(false)
    expect(insertedCount.value).toBe(5) // pas d'insert si refusé
  })

  it('inclut le bucket dans l\'insert', async () => {
    insertedCount.value = 0
    const { checkRateLimit } = await import('@/lib/rate-limit')
    await checkRateLimit('access:hashed-ip', 5, 60)
    expect(insertedCount.lastBucket).toBe('access:hashed-ip')
  })
})
