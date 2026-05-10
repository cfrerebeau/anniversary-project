import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * On mocke @/lib/supabase/server (auth.getUser + table guests) et next/navigation
 * (redirect) pour isoler la logique de requireGuest / getCurrentGuest.
 */

const mockState: {
  user: { email: string } | null
  guestRow: {
    id: string
    email: string
    full_name: string | null
    is_blocked: boolean
    first_visit_at: string | null
    last_visit_at: string | null
  } | null
  redirected: string | null
  updates: Array<Record<string, unknown>>
} = {
  user: null,
  guestRow: null,
  redirected: null,
  updates: [],
}

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockState.redirected = url
    throw new Error(`__REDIRECT__:${url}`)
  },
}))

vi.mock('next/server', () => ({
  // Hors scope de requête (vitest) : on exécute le callback immédiatement.
  after: (cb: () => unknown | Promise<unknown>) => {
    void Promise.resolve().then(cb)
  },
}))

vi.mock('@/lib/supabase/server', () => {
  return {
    getServerClient: async () => ({
      auth: {
        getUser: async () => ({
          data: { user: mockState.user ? { email: mockState.user.email } : null },
        }),
      },
    }),
    getServiceClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: mockState.guestRow }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: () => {
            mockState.updates.push(payload)
            return Promise.resolve({ error: null })
          },
        }),
      }),
    }),
  }
})

beforeEach(() => {
  mockState.user = null
  mockState.guestRow = null
  mockState.redirected = null
  mockState.updates = []
})

describe('requireGuest', () => {
  it('redirect /access si pas de session', async () => {
    const { requireGuest } = await import('@/lib/auth')
    await expect(requireGuest()).rejects.toThrow('__REDIRECT__:/access')
    expect(mockState.redirected).toBe('/access')
  })

  it('redirect /access si email inconnu (pas de row guests)', async () => {
    mockState.user = { email: 'rand@example.com' }
    mockState.guestRow = null
    const { requireGuest } = await import('@/lib/auth')
    await expect(requireGuest()).rejects.toThrow('__REDIRECT__:/access')
  })

  it('redirect /access si guest is_blocked=true', async () => {
    mockState.user = { email: 'brice@example.com' }
    mockState.guestRow = {
      id: 'g1',
      email: 'brice@example.com',
      full_name: 'Brice',
      is_blocked: true,
      first_visit_at: null,
      last_visit_at: null,
    }
    const { requireGuest } = await import('@/lib/auth')
    await expect(requireGuest()).rejects.toThrow('__REDIRECT__:/access')
  })

  it('renvoie le guest si valide', async () => {
    mockState.user = { email: 'maxime@example.com' }
    mockState.guestRow = {
      id: 'g42',
      email: 'maxime@example.com',
      full_name: 'Maxime Durand',
      is_blocked: false,
      first_visit_at: null,
      last_visit_at: null,
    }
    const { requireGuest, getFirstName } = await import('@/lib/auth')
    const guest = await requireGuest()
    expect(guest.id).toBe('g42')
    expect(getFirstName(guest)).toBe('Maxime')
  })

  it('déclenche une mise à jour de last_visit_at au premier passage', async () => {
    mockState.user = { email: 'first@example.com' }
    mockState.guestRow = {
      id: 'g1',
      email: 'first@example.com',
      full_name: null,
      is_blocked: false,
      first_visit_at: null,
      last_visit_at: null,
    }
    const { requireGuest } = await import('@/lib/auth')
    await requireGuest()
    // L'update est fire-and-forget : laisser la microtask passer
    await new Promise((r) => setImmediate(r))
    expect(mockState.updates.length).toBe(1)
  })

  it("ne déclenche PAS d'update si last_visit_at < 1h", async () => {
    mockState.user = { email: 'recent@example.com' }
    mockState.guestRow = {
      id: 'g1',
      email: 'recent@example.com',
      full_name: null,
      is_blocked: false,
      first_visit_at: new Date(Date.now() - 86400_000).toISOString(),
      last_visit_at: new Date(Date.now() - 60_000).toISOString(), // il y a 1 minute
    }
    const { requireGuest } = await import('@/lib/auth')
    await requireGuest()
    await new Promise((r) => setImmediate(r))
    expect(mockState.updates.length).toBe(0)
  })
})
