import { describe, expect, it } from 'vitest'
import { daysSinceWedding } from '../lib/format'

const WEDDING = '2026-05-23T12:00:00+02:00' // 23 mai 2026, Europe/Paris

describe('daysSinceWedding', () => {
  it('returns 0 on the wedding day in Paris', () => {
    // Plein milieu de l'aprem Paris.
    const now = new Date('2026-05-23T15:00:00+02:00')
    expect(daysSinceWedding(WEDDING, now)).toBe(0)
  })

  it('returns -1 the day before', () => {
    const now = new Date('2026-05-22T15:00:00+02:00')
    expect(daysSinceWedding(WEDDING, now)).toBe(-1)
  })

  it('returns 1 the day after', () => {
    const now = new Date('2026-05-24T08:00:00+02:00')
    expect(daysSinceWedding(WEDDING, now)).toBe(1)
  })

  it('returns 3 three days after', () => {
    const now = new Date('2026-05-26T11:00:00+02:00')
    expect(daysSinceWedding(WEDDING, now)).toBe(3)
  })

  it('handles UTC vs Paris timezone correctly around midnight', () => {
    // 23 mai à 23h45 UTC = 24 mai à 01h45 Paris → on est déjà à J+1.
    const now = new Date('2026-05-23T23:45:00Z')
    expect(daysSinceWedding(WEDDING, now)).toBe(1)
  })
})
