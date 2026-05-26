import { describe, it, expect } from 'vitest'
import {
  accessSchema,
  cagnotteMessageSchema,
  quizQuestionSchema,
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

describe('quizQuestionSchema', () => {
  const ok = {
    question: 'En quelle année ils se sont rencontrés ?',
    options: ['2010', '2012', '2015'],
    correct_index: 1,
  }
  it('accepte une question valide', () => {
    expect(quizQuestionSchema.safeParse(ok).success).toBe(true)
  })
  it('rejette une question trop courte', () => {
    expect(quizQuestionSchema.safeParse({ ...ok, question: 'eh' }).success).toBe(false)
  })
  it('rejette moins de 2 options', () => {
    expect(quizQuestionSchema.safeParse({ ...ok, options: ['seul'] }).success).toBe(false)
  })
  it('rejette plus de 4 options', () => {
    expect(
      quizQuestionSchema.safeParse({ ...ok, options: ['a', 'b', 'c', 'd', 'e'] }).success,
    ).toBe(false)
  })
  it('rejette correct_index hors options', () => {
    expect(quizQuestionSchema.safeParse({ ...ok, correct_index: 5 }).success).toBe(false)
  })
  it('rejette deux options identiques (même casse)', () => {
    expect(
      quizQuestionSchema.safeParse({ ...ok, options: ['Paris', 'paris'] }).success,
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
  it('accepte un image/heic < 200 MB sur le bucket souvenirs', () => {
    expect(
      photoSignSchema.safeParse({
        filename: 'IMG_0001.HEIC',
        content_type: 'image/heic',
        size_bytes: 4_000_000,
        bucket: 'souvenirs',
      }).success,
    ).toBe(true)
  })
  it('accepte un video/mp4 sur le bucket event', () => {
    expect(
      photoSignSchema.safeParse({
        filename: 'fete.mp4',
        content_type: 'video/mp4',
        size_bytes: 80 * 1024 * 1024,
        bucket: 'event',
      }).success,
    ).toBe(true)
  })
  it('rejette un application/pdf', () => {
    expect(
      photoSignSchema.safeParse({
        filename: 'doc.pdf',
        content_type: 'application/pdf',
        size_bytes: 100_000,
        bucket: 'souvenirs',
      }).success,
    ).toBe(false)
  })
  it('rejette > 200 MB (le cap par-bucket est appliqué dans la route)', () => {
    expect(
      photoSignSchema.safeParse({
        filename: 'huge.mp4',
        content_type: 'video/mp4',
        size_bytes: 300 * 1024 * 1024,
        bucket: 'event',
      }).success,
    ).toBe(false)
  })
  it('requires bucket', () => {
    expect(
      photoSignSchema.safeParse({
        filename: 'IMG_0001.jpg',
        content_type: 'image/jpeg',
        size_bytes: 1_000_000,
      }).success,
    ).toBe(false)
  })
  it("rejette un bucket inconnu", () => {
    expect(
      photoSignSchema.safeParse({
        filename: 'IMG_0001.jpg',
        content_type: 'image/jpeg',
        size_bytes: 1_000_000,
        bucket: 'random',
      }).success,
    ).toBe(false)
  })
})
