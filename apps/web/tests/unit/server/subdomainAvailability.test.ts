import { describe, expect, it, vi } from 'vitest'
import { ClientResponseError } from 'pocketbase'
import { checkSubdomainAvailability, validateSubdomain } from '../../../server/utils/provisioning'

function createMockPb(options: { exists?: boolean, throws?: Error }) {
  return {
    collection: () => ({
      getFirstListItem: vi.fn(async () => {
        if (options.throws) throw options.throws
        if (options.exists) return { id: 'org-1' }
        throw new ClientResponseError({ url: '', status: 404, data: {}, isAbort: false, originalError: null })
      })
    })
  }
}

describe('checkSubdomainAvailability', () => {
  it('returns validation errors for invalid slugs', async () => {
    const pb = createMockPb({})
    const result = await checkSubdomainAvailability(pb as never, 'www')
    expect(result.available).toBe(false)
    expect(result.reason).toMatch(/reserved/i)
  })

  it('returns available when organization is not found', async () => {
    const pb = createMockPb({ exists: false })
    const result = await checkSubdomainAvailability(pb as never, 'acme')
    expect(result.available).toBe(true)
  })

  it('returns unavailable when organization exists', async () => {
    const pb = createMockPb({ exists: true })
    const result = await checkSubdomainAvailability(pb as never, 'acme')
    expect(result.available).toBe(false)
    expect(result.reason).toMatch(/already in use/i)
  })

  it('reuses validateSubdomain for reserved slugs', () => {
    expect(validateSubdomain('api')).toMatch(/reserved/i)
  })
})
