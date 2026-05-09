import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { hashIP } from '@/lib/ip'

describe('hashIP', () => {
  let originalSalt: string | undefined

  beforeEach(() => {
    originalSalt = process.env.IP_HASH_SALT
  })
  afterEach(() => {
    if (originalSalt === undefined) delete process.env.IP_HASH_SALT
    else process.env.IP_HASH_SALT = originalSalt
  })

  it('produit un hash stable pour la même IP', () => {
    process.env.IP_HASH_SALT = 'test-salt-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const a = hashIP('192.0.2.1')
    const b = hashIP('192.0.2.1')
    expect(a).toBe(b)
    expect(a).toHaveLength(64) // sha256 hex
  })

  it('produit un hash différent pour des IPs différentes', () => {
    process.env.IP_HASH_SALT = 'test-salt-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    expect(hashIP('192.0.2.1')).not.toBe(hashIP('192.0.2.2'))
  })

  it('produit un hash différent avec un autre sel', () => {
    process.env.IP_HASH_SALT = 'salt-A'
    const r1 = hashIP('192.0.2.1')
    process.env.IP_HASH_SALT = 'salt-B'
    expect(hashIP('192.0.2.1')).not.toBe(r1)
  })

  it('jette si le sel est vide', () => {
    process.env.IP_HASH_SALT = ''
    expect(() => hashIP('192.0.2.1')).toThrow(/IP_HASH_SALT/)
  })
})
