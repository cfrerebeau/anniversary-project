import { describe, it, expect } from 'vitest'
import { formatEUR, daysUntil, formatDateFR } from '@/lib/format'

describe('formatEUR', () => {
  it('formate 0 cents en "0 €"', () => {
    expect(formatEUR(0)).toBe('0 €')
  })
  it('formate 12 500 cents en "125 €"', () => {
    expect(formatEUR(12500)).toBe('125 €')
  })
  it('formate 324 000 cents en "3 240 €" (espace insécable FR)', () => {
    const out = formatEUR(324000)
    expect(out.replace(/\s/g, ' ')).toBe('3 240 €')
  })
  it('arrondit les centimes au plus proche', () => {
    expect(formatEUR(1249)).toBe('12 €')
    expect(formatEUR(1250)).toBe('13 €')
  })
})

describe('daysUntil', () => {
  it('renvoie 0 pour une date passée', () => {
    expect(daysUntil('1990-01-01')).toBe(0)
  })
  it('renvoie un nombre positif pour le futur', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysUntil(future)).toBeGreaterThanOrEqual(4)
    expect(daysUntil(future)).toBeLessThanOrEqual(6)
  })
})

describe('formatDateFR', () => {
  it('produit une date FR en clair', () => {
    const d = new Date('2026-09-12T12:00:00Z')
    const out = formatDateFR(d, { day: 'numeric', month: 'long' })
    expect(out).toMatch(/septembre/)
  })
})
