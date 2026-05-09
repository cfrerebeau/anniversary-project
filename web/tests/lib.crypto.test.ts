import { describe, it, expect } from 'vitest'
import { constantTimeEqual, randomDelayMs } from '@/lib/crypto'

describe('constantTimeEqual', () => {
  it('renvoie true pour deux strings identiques', () => {
    expect(constantTimeEqual('abcdef', 'abcdef')).toBe(true)
  })
  it('renvoie false pour des longueurs différentes', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
  })
  it('renvoie false pour des strings différentes de même longueur', () => {
    expect(constantTimeEqual('abcdef', 'abcdeF')).toBe(false)
  })
  it('gère les strings vides', () => {
    expect(constantTimeEqual('', '')).toBe(true)
    expect(constantTimeEqual('', 'a')).toBe(false)
  })
})

describe('randomDelayMs', () => {
  it('reste dans la fourchette demandée', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomDelayMs(100, 200)
      expect(v).toBeGreaterThanOrEqual(100)
      expect(v).toBeLessThan(200)
    }
  })
})
