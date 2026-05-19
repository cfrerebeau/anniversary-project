import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  TRANSITION_KINDS,
  clampConfig,
  inAnimationClass,
  outAnimationClass,
  pickTransitionKind,
  resumeFromSnapshot,
  shuffle,
  type ResumeSnapshot,
  type TransitionKind,
} from '../components/admin/photos-diaporama.helpers'

// Petit RNG déterministe pour tester sans flakiness.
function seededRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

describe('clampConfig', () => {
  it('clamps timePerPhoto into [2, 30] integer range', () => {
    expect(clampConfig({ timePerPhoto: 1 } as never).timePerPhoto).toBe(2)
    expect(clampConfig({ timePerPhoto: 100 } as never).timePerPhoto).toBe(30)
    expect(clampConfig({ timePerPhoto: 4.6 } as never).timePerPhoto).toBe(5)
    expect(clampConfig({ timePerPhoto: 5 } as never).timePerPhoto).toBe(5)
  })

  it('falls back to default when timePerPhoto is NaN or missing', () => {
    expect(clampConfig({ timePerPhoto: Number.NaN } as never).timePerPhoto).toBe(
      DEFAULT_CONFIG.timePerPhoto,
    )
    expect(clampConfig({}).timePerPhoto).toBe(DEFAULT_CONFIG.timePerPhoto)
  })

  it('keeps known transitions and falls back when unknown', () => {
    for (const k of TRANSITION_KINDS) {
      expect(clampConfig({ transition: k } as never).transition).toBe(k)
    }
    expect(clampConfig({ transition: 'random' } as never).transition).toBe('random')
    expect(clampConfig({ transition: 'bogus' as never } as never).transition).toBe(
      DEFAULT_CONFIG.transition,
    )
  })

  it('coerces random to boolean', () => {
    expect(clampConfig({ random: true } as never).random).toBe(true)
    expect(clampConfig({ random: false } as never).random).toBe(false)
    expect(clampConfig({ random: 'truthy' as never } as never).random).toBe(true)
  })
})

describe('shuffle', () => {
  it('returns a permutation containing the same elements', () => {
    const input = ['a', 'b', 'c', 'd', 'e']
    const shuffled = shuffle(input, seededRng(42))
    expect(shuffled).toHaveLength(input.length)
    expect([...shuffled].sort()).toEqual([...input].sort())
  })

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c']
    const copy = input.slice()
    shuffle(input, seededRng(1))
    expect(input).toEqual(copy)
  })

  it('is deterministic with the same seed', () => {
    const a = shuffle(['1', '2', '3', '4', '5'], seededRng(123))
    const b = shuffle(['1', '2', '3', '4', '5'], seededRng(123))
    expect(a).toEqual(b)
  })
})

describe('pickTransitionKind', () => {
  it('returns the explicit kind when not random', () => {
    for (const k of TRANSITION_KINDS) {
      expect(pickTransitionKind(k, null)).toBe(k)
      expect(pickTransitionKind(k, 'fade')).toBe(k)
    }
  })

  it('never repeats the previous kind in random mode', () => {
    const rng = seededRng(7)
    let previous: TransitionKind | null = null
    for (let i = 0; i < 200; i++) {
      const next = pickTransitionKind('random', previous, rng)
      if (previous) expect(next).not.toBe(previous)
      expect(TRANSITION_KINDS).toContain(next)
      previous = next
    }
  })

  it('still returns a valid kind when previous is null', () => {
    const out = pickTransitionKind('random', null, seededRng(3))
    expect(TRANSITION_KINDS).toContain(out)
  })
})

describe('resumeFromSnapshot', () => {
  const baseSnap = (overrides: Partial<ResumeSnapshot> = {}): ResumeSnapshot => ({
    config: DEFAULT_CONFIG,
    order: ['a', 'b', 'c', 'd'],
    currentPhotoId: 'b',
    currentIndex: 1,
    savedAt: 0,
    ...overrides,
  })

  it('resumes on the saved photo when still present', () => {
    const r = resumeFromSnapshot(baseSnap(), new Set(['a', 'b', 'c', 'd']))
    expect(r).toEqual({ order: ['a', 'b', 'c', 'd'], index: 1 })
  })

  it('advances to next surviving id after deletion of current', () => {
    // 'b' deleted ; doit ressortir à 'c' (premier survivant ≥ index 1 dans l'ordre original)
    const r = resumeFromSnapshot(baseSnap(), new Set(['a', 'c', 'd']))
    expect(r).toEqual({ order: ['a', 'c', 'd'], index: 1 }) // 'c' est à index 1 dans le filtré
  })

  it('falls back to a surviving id before saved index when nothing after survives', () => {
    // Tout ce qui est ≥ index 1 est supprimé : on remonte sur 'a'.
    const r = resumeFromSnapshot(baseSnap(), new Set(['a']))
    expect(r).toEqual({ order: ['a'], index: 0 })
  })

  it('returns null when nothing survives', () => {
    const r = resumeFromSnapshot(baseSnap(), new Set())
    expect(r).toBeNull()
  })

  it('handles deletion of earlier items without misaligning', () => {
    // 'a' supprimé : 'b' reste à index 0 dans le filtré, pas index 1.
    const r = resumeFromSnapshot(baseSnap(), new Set(['b', 'c', 'd']))
    expect(r).toEqual({ order: ['b', 'c', 'd'], index: 0 })
  })
})

describe('animation class helpers', () => {
  it('returns the expected ba-dia-* classes', () => {
    expect(inAnimationClass('fade')).toBe('ba-dia-in-fade')
    expect(outAnimationClass('fade')).toBe('ba-dia-out-fade')
    expect(inAnimationClass('slide')).toBe('ba-dia-in-slide')
    expect(outAnimationClass('cut')).toBe('ba-dia-out-cut')
  })
})
