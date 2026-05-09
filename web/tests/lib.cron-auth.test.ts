import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'

function reqWith(authHeader: string | null): NextRequest {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader : null),
    },
  } as unknown as NextRequest
}

describe('isAuthorizedCron', () => {
  let originalSecret: string | undefined

  beforeEach(() => {
    originalSecret = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'good-secret-1234567890abcdef'
  })
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalSecret
  })

  it('refuse une requête sans header Authorization', () => {
    expect(isAuthorizedCron(reqWith(null))).toBe(false)
  })

  it('refuse un Bearer vide', () => {
    expect(isAuthorizedCron(reqWith('Bearer '))).toBe(false)
  })

  it('refuse un mauvais token de même longueur (constant-time check)', () => {
    expect(isAuthorizedCron(reqWith('Bearer wrong-secret-1234567890abcdef'))).toBe(false)
  })

  it('refuse un mauvais token de longueur différente', () => {
    expect(isAuthorizedCron(reqWith('Bearer too-short'))).toBe(false)
  })

  it('refuse un header sans préfixe Bearer', () => {
    expect(isAuthorizedCron(reqWith('good-secret-1234567890abcdef'))).toBe(false)
  })

  it('accepte le bon token avec préfixe Bearer', () => {
    expect(isAuthorizedCron(reqWith('Bearer good-secret-1234567890abcdef'))).toBe(true)
  })

  it('refuse si CRON_SECRET n\'est pas configuré', () => {
    delete process.env.CRON_SECRET
    expect(isAuthorizedCron(reqWith('Bearer good-secret-1234567890abcdef'))).toBe(false)
  })
})
