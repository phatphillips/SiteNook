import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createCipheriv, randomBytes } from 'node:crypto'
import {
  encryptCredentials,
  decryptCredentials,
  maskSecretLast4,
  isEncryptionConfigured
} from '../../../server/utils/analytics/crypto'

const KEY = Buffer.alloc(32, 7).toString('base64')

describe('analytics crypto', () => {
  const prev = process.env.ANALYTICS_CREDENTIALS_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ANALYTICS_CREDENTIALS_ENCRYPTION_KEY = KEY
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.ANALYTICS_CREDENTIALS_ENCRYPTION_KEY
    else process.env.ANALYTICS_CREDENTIALS_ENCRYPTION_KEY = prev
  })

  it('round-trips credentials', () => {
    const payload = { apiToken: 'secret-token-abcdef', zoneId: 'zone123' }
    const encrypted = encryptCredentials(payload)
    expect(encrypted).not.toContain('secret-token')
    const decrypted = decryptCredentials<typeof payload>(encrypted)
    expect(decrypted).toEqual(payload)
  })

  it('produces different ciphertext each call (random IV)', () => {
    const payload = { apiKey: 'abc' }
    const a = encryptCredentials(payload)
    const b = encryptCredentials(payload)
    expect(a).not.toBe(b)
    expect(decryptCredentials(a)).toEqual(payload)
    expect(decryptCredentials(b)).toEqual(payload)
  })

  it('rejects wrong key', () => {
    const encrypted = encryptCredentials({ a: 1 })
    const otherKey = Buffer.alloc(32, 9).toString('base64')
    expect(() => decryptCredentials(encrypted, otherKey)).toThrow()
  })

  it('maskSecretLast4 returns last 4 chars', () => {
    expect(maskSecretLast4('abcd1234')).toBe('1234')
    expect(maskSecretLast4('ab')).toBeUndefined()
  })

  it('isEncryptionConfigured reflects env', () => {
    expect(isEncryptionConfigured()).toBe(true)
    delete process.env.ANALYTICS_CREDENTIALS_ENCRYPTION_KEY
    expect(isEncryptionConfigured()).toBe(false)
  })

  it('rejects truncated payload', () => {
    const iv = randomBytes(12)
    const tag = randomBytes(16)
    const bogus = Buffer.concat([iv, tag]).toString('base64')
    expect(() => decryptCredentials(bogus)).toThrow()
  })

  it('does not accept non-gcm crafted buffer as valid json without tag', () => {
    // sanity: encrypt path uses gcm; forge without proper tag fails
    const key = Buffer.from(KEY, 'base64')
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const enc = Buffer.concat([cipher.update('{"x":1}'), cipher.final()])
    const bad = Buffer.concat([iv, randomBytes(16), enc]).toString('base64')
    expect(() => decryptCredentials(bad)).toThrow()
  })
})
