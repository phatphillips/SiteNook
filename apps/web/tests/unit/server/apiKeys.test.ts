import { describe, it, expect } from 'vitest'
import {
  generateApiKeySecret,
  hashApiKey,
  isApiKeyToken,
  normalizeScopes,
  scopesAllowWrite,
  toPublicApiKey
} from '../../../server/utils/apiKeys'

describe('apiKeys', () => {
  it('generates ak_ secrets with matching hash and prefix', () => {
    const { plaintext, prefix, hash } = generateApiKeySecret()
    expect(isApiKeyToken(plaintext)).toBe(true)
    expect(plaintext.startsWith('ak_')).toBe(true)
    expect(prefix).toBe(plaintext.slice(0, 11))
    expect(hash).toBe(hashApiKey(plaintext))
    expect(hash).toHaveLength(64)
  })

  it('normalizes scopes and implies read when write is set', () => {
    expect(normalizeScopes(['write'])).toEqual(['write', 'read'])
    expect(normalizeScopes(['read'])).toEqual(['read'])
    expect(normalizeScopes([])).toEqual(['read'])
    expect(scopesAllowWrite(['read'])).toBe(false)
    expect(scopesAllowWrite(['read', 'write'])).toBe(true)
  })

  it('strips secrets from public metadata', () => {
    const meta = toPublicApiKey({
      id: 'k1',
      organization: 'org1',
      name: 'Cursor',
      key_prefix: 'ak_abc',
      key_hash: 'deadbeef',
      scopes: ['read', 'write'],
      revoked_at: undefined
    })
    expect(meta).toMatchObject({
      id: 'k1',
      name: 'Cursor',
      key_prefix: 'ak_abc',
      scopes: ['read', 'write']
    })
    expect(meta).not.toHaveProperty('key_hash')
  })
})
