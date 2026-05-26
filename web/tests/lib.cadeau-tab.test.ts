import { describe, expect, it } from 'vitest'
import { parseCadeauTab } from '../lib/cadeau-tab'

describe('parseCadeauTab', () => {
  it('returns fete when undefined', () => {
    expect(parseCadeauTab(undefined)).toBe('fete')
  })

  it('returns mots / avant / fete on exact match', () => {
    expect(parseCadeauTab('mots')).toBe('mots')
    expect(parseCadeauTab('avant')).toBe('avant')
    expect(parseCadeauTab('fete')).toBe('fete')
  })

  it('falls back to fete on unknown value', () => {
    expect(parseCadeauTab('lol')).toBe('fete')
    expect(parseCadeauTab('')).toBe('fete')
  })

  it('rejects array (query pollution)', () => {
    expect(parseCadeauTab(['mots', 'avant'])).toBe('fete')
    expect(parseCadeauTab(['fete'])).toBe('fete')
  })
})
