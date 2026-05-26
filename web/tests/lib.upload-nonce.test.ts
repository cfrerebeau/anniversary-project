import { beforeAll, describe, expect, it } from 'vitest'
import { issueUploadNonce, verifyUploadNonce } from '../lib/upload-nonce'

const PAYLOAD = {
  guestId: '11111111-1111-1111-1111-111111111111',
  bucket: 'souvenirs' as const,
  path: '11111111-1111-1111-1111-111111111111/1700000000-deadbeef-foo.jpg',
}

beforeAll(() => {
  process.env.SESSION_COOKIE_SECRET =
    process.env.SESSION_COOKIE_SECRET || 'test-secret-at-least-16-chars-long'
})

describe('upload-nonce', () => {
  it('issues and verifies a fresh nonce', () => {
    const { nonce, exp } = issueUploadNonce(PAYLOAD)
    expect(verifyUploadNonce(PAYLOAD, nonce, exp)).toBe(true)
  })

  it('rejects an expired nonce', () => {
    const { nonce } = issueUploadNonce(PAYLOAD)
    const expired = Date.now() - 1000
    expect(verifyUploadNonce(PAYLOAD, nonce, expired)).toBe(false)
  })

  it('rejects when bucket is tampered', () => {
    const { nonce, exp } = issueUploadNonce(PAYLOAD)
    expect(
      verifyUploadNonce({ ...PAYLOAD, bucket: 'event' }, nonce, exp),
    ).toBe(false)
  })

  it('rejects when path is tampered', () => {
    const { nonce, exp } = issueUploadNonce(PAYLOAD)
    expect(
      verifyUploadNonce({ ...PAYLOAD, path: PAYLOAD.path + 'x' }, nonce, exp),
    ).toBe(false)
  })

  it('rejects when guest is tampered', () => {
    const { nonce, exp } = issueUploadNonce(PAYLOAD)
    expect(
      verifyUploadNonce(
        { ...PAYLOAD, guestId: '22222222-2222-2222-2222-222222222222' },
        nonce,
        exp,
      ),
    ).toBe(false)
  })

  it('rejects a malformed nonce', () => {
    const { exp } = issueUploadNonce(PAYLOAD)
    expect(verifyUploadNonce(PAYLOAD, 'not-hex', exp)).toBe(false)
    expect(verifyUploadNonce(PAYLOAD, 'a'.repeat(63), exp)).toBe(false)
  })
})
