import { describe, it, expect } from 'vitest'
import { generateKeyPairSync, sign } from 'node:crypto'
import { verifyWiseSignature } from '@/lib/wise-webhook'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
})
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

const otherKeypair = generateKeyPairSync('rsa', { modulusLength: 2048 })
const otherPublicPem = otherKeypair.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString()

function signBody(body: string): string {
  return sign('RSA-SHA256', Buffer.from(body, 'utf8'), privateKey).toString(
    'base64',
  )
}

describe('verifyWiseSignature', () => {
  const body = JSON.stringify({
    event_type: 'balances#credit',
    data: { amount: 12.34, currency: 'EUR' },
  })

  it('accepte une signature valide produite avec la clé privée correspondante', () => {
    expect(verifyWiseSignature(body, signBody(body), publicPem)).toBe(true)
  })

  it('accepte aussi quand le corps est passé en Buffer', () => {
    expect(
      verifyWiseSignature(Buffer.from(body, 'utf8'), signBody(body), publicPem),
    ).toBe(true)
  })

  it('rejette si le corps a été modifié après signature', () => {
    const sig = signBody(body)
    const tampered = body.replace('12.34', '99.99')
    expect(verifyWiseSignature(tampered, sig, publicPem)).toBe(false)
  })

  it('rejette une signature signée avec une autre clé', () => {
    expect(verifyWiseSignature(body, signBody(body), otherPublicPem)).toBe(false)
  })

  it('rejette une signature absente', () => {
    expect(verifyWiseSignature(body, null, publicPem)).toBe(false)
    expect(verifyWiseSignature(body, '', publicPem)).toBe(false)
    expect(verifyWiseSignature(body, undefined, publicPem)).toBe(false)
  })

  it('rejette si la clé publique n\'est pas configurée', () => {
    expect(verifyWiseSignature(body, signBody(body), undefined)).toBe(false)
    expect(verifyWiseSignature(body, signBody(body), '')).toBe(false)
  })

  it('rejette une signature non-base64 / corrompue sans throw', () => {
    expect(verifyWiseSignature(body, '!!!not-base64!!!', publicPem)).toBe(false)
  })

  it('rejette quand la clé publique n\'est pas un PEM valide', () => {
    expect(verifyWiseSignature(body, signBody(body), 'not-a-pem')).toBe(false)
  })
})
