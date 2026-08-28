import { describe, expect, it } from 'vitest'
import {
  hintLicenceKey,
  isPolarLicenceGranted,
  validatePolarLicenseKey
} from '../../../src/licence/polarLicence.js'

describe('polarLicence', () => {
  it('rejects empty key or org id', async () => {
    const missingOrg = await validatePolarLicenseKey({ key: 'AIQ_x', organizationId: '' })
    expect(missingOrg.valid).toBe(false)
    const missingKey = await validatePolarLicenseKey({ key: '', organizationId: 'org' })
    expect(missingKey.valid).toBe(false)
  })

  it('treats granted unexpired keys as valid', async () => {
    const fetchImpl = async () => ({
      ok: true,
      text: async () => JSON.stringify({
        status: 'granted',
        expires_at: '2099-01-01T00:00:00.000Z',
        id: 'lk_1'
      })
    }) as unknown as typeof fetch

    const result = await validatePolarLicenseKey({
      key: 'AIQ_test',
      organizationId: '11111111-1111-4111-8111-111111111111',
      fetchImpl
    })
    expect(result.valid).toBe(true)
    expect(result.status).toBe('granted')
  })

  it('rejects revoked Polar keys', async () => {
    const fetchImpl = async () => ({
      ok: true,
      text: async () => JSON.stringify({ status: 'revoked', expires_at: null })
    }) as unknown as typeof fetch

    const result = await validatePolarLicenseKey({
      key: 'AIQ_test',
      organizationId: '11111111-1111-4111-8111-111111111111',
      fetchImpl
    })
    expect(result.valid).toBe(false)
  })

  it('maps 404 to invalid key', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 404,
      text: async () => ''
    }) as unknown as typeof fetch

    const result = await validatePolarLicenseKey({
      key: 'AIQ_bad',
      organizationId: '11111111-1111-4111-8111-111111111111',
      fetchImpl
    })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/invalid/i)
  })

  it('hints keys without exposing the full value', () => {
    expect(hintLicenceKey('AIQ_ABCDEFGHIJKLMN')).toBe('AIQ_…KLMN')
    expect(isPolarLicenceGranted({ status: 'granted' })).toBe(true)
    expect(isPolarLicenceGranted({ status: 'granted', expires_at: '2000-01-01T00:00:00.000Z' })).toBe(false)
  })
})
