import { describe, expect, it } from 'vitest'
import {
  hintLicenceKey,
  isPolarLicenceGranted,
  validatePolarLicenseKey
} from '../../../server/utils/polarLicence'

describe('polarLicence', () => {
  it('treats granted keys as valid and 404 as invalid', async () => {
    const granted = await validatePolarLicenseKey({
      key: 'AIQ_test',
      organizationId: '11111111-1111-4111-8111-111111111111',
      fetchImpl: async () => ({
        ok: true,
        text: async () => JSON.stringify({ status: 'granted', expires_at: null })
      }) as unknown as typeof fetch
    })
    expect(granted.valid).toBe(true)

    const missing = await validatePolarLicenseKey({
      key: 'AIQ_bad',
      organizationId: '11111111-1111-4111-8111-111111111111',
      fetchImpl: async () => ({
        ok: false,
        status: 404,
        text: async () => ''
      }) as unknown as typeof fetch
    })
    expect(missing.valid).toBe(false)
    expect(hintLicenceKey('AIQ_ABCDEFGHIJKLMN')).toBe('AIQ_…KLMN')
    expect(isPolarLicenceGranted({ status: 'revoked' })).toBe(false)
  })
})
