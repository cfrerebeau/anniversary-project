import { describe, it, expect } from 'vitest'
import {
  accessSchema,
  cagnotteMessageSchema,
  anecdoteSchema,
  photoSignSchema,
} from '@/lib/validators'

describe('accessSchema', () => {
  it('accepte un email valide', () => {
    const r = accessSchema.safeParse({ email: 'a@b.fr' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('a@b.fr')
  })
  it('lowercase et trim l\'email', () => {
    const r = accessSchema.safeParse({ email: '  Hello@TEST.fr ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('hello@test.fr')
  })
  it('rejette un email vide', () => {
    expect(accessSchema.safeParse({ email: '' }).success).toBe(false)
  })
  it('rejette un email malformé', () => {
    expect(accessSchema.safeParse({ email: 'pas un email' }).success).toBe(false)
  })
})

describe('anecdoteSchema', () => {
  it('rejette une story trop courte', () => {
    expect(anecdoteSchema.safeParse({ story: 'court' }).success).toBe(false)
  })
  it('accepte une story d\'au moins 20 chars', () => {
    expect(
      anecdoteSchema.safeParse({ story: 'Une histoire suffisamment longue.' }).success,
    ).toBe(true)
  })
  it('valide les options "since" autorisées', () => {
    expect(
      anecdoteSchema.safeParse({ story: 'a'.repeat(30), since: 'la vie' }).success,
    ).toBe(true)
    expect(
      anecdoteSchema.safeParse({ story: 'a'.repeat(30), since: 'jamais' }).success,
    ).toBe(false)
  })
})

describe('cagnotteMessageSchema', () => {
  it('accepte avec montant et message', () => {
    expect(
      cagnotteMessageSchema.safeParse({
        display_name: 'Maxime',
        amount_cents: 5000,
        message: 'Bisou',
      }).success,
    ).toBe(true)
  })
  it('accepte sans montant', () => {
    expect(
      cagnotteMessageSchema.safeParse({ display_name: 'Maxime' }).success,
    ).toBe(true)
  })
  it('rejette un display_name vide', () => {
    expect(
      cagnotteMessageSchema.safeParse({ display_name: '   ' }).success,
    ).toBe(false)
  })
  it('rejette un montant trop grand', () => {
    expect(
      cagnotteMessageSchema.safeParse({
        display_name: 'Maxime',
        amount_cents: 9_999_999,
      }).success,
    ).toBe(false)
  })
})

describe('photoSignSchema', () => {
  it('accepte un image/jpeg < 50 MB', () => {
    expect(
      photoSignSchema.safeParse({
        filename: 'IMG_0001.HEIC',
        content_type: 'image/heic',
        size_bytes: 4_000_000,
      }).success,
    ).toBe(true)
  })
  it('rejette un application/pdf', () => {
    expect(
      photoSignSchema.safeParse({
        filename: 'doc.pdf',
        content_type: 'application/pdf',
        size_bytes: 100_000,
      }).success,
    ).toBe(false)
  })
  it('rejette > 50 MB', () => {
    expect(
      photoSignSchema.safeParse({
        filename: 'big.mp4',
        content_type: 'video/mp4',
        size_bytes: 60 * 1024 * 1024,
      }).success,
    ).toBe(false)
  })
})
