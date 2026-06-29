import { describe, expect, it } from 'vitest'
import {
  buildLicenceTokenPayload,
  hashInstanceFingerprint,
  signLicenceToken,
  verifyLicenceToken
} from '../../../server/utils/licenceTokens'

function withLicenceSecret<T>(fn: () => T): T {
  const previous = process.env.NUXT_LICENCE_SIGNING_SECRET
  process.env.NUXT_LICENCE_SIGNING_SECRET = 'test-licence-signing-secret'
  try {
    return fn()
  } finally {
    if (previous === undefined) {
      delete process.env.NUXT_LICENCE_SIGNING_SECRET
    } else {
      process.env.NUXT_LICENCE_SIGNING_SECRET = previous
    }
  }
}

describe('licenceTokens', () => {
  it('signs and verifies licence tokens', () => {
    withLicenceSecret(() => {
      const payload = buildLicenceTokenPayload({
        key: 'lic-test-key',
        tier: 'enterprise',
        domain: 'council.example.gov.au',
        fingerprint: 'abc123',
        expires_at: '2027-01-01T00:00:00.000Z'
      })
      const token = signLicenceToken(payload)
      const verified = verifyLicenceToken(token)
      expect(verified.key).toBe('lic-test-key')
      expect(verified.tier).toBe('enterprise')
    })
  })

  it('hashes instance fingerprints deterministically', () => {
    const a = hashInstanceFingerprint('Example.COM', 'machine-1')
    const b = hashInstanceFingerprint('example.com', 'machine-1')
    expect(a).toBe(b)
  })
})
