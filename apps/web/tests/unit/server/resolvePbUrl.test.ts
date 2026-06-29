import { describe, it, expect, vi } from 'vitest'
import { createEvent } from 'h3'

describe('resolveServerPocketBaseUrl', () => {
  it('prefers NUXT_POCKETBASE_URL over the public browser URL', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      pocketbaseUrl: 'http://pocketbase:8090',
      public: { pocketbaseUrl: 'http://localhost:8090' }
    }))

    const { resolveServerPocketBaseUrl } = await import('../../../server/utils/resolvePbUrl')
    const event = createEvent({ method: 'GET', url: '/api/team-activity-log' })

    expect(resolveServerPocketBaseUrl(event)).toBe('http://pocketbase:8090')
  })

  it('falls back to an absolute public URL when server URL is unset', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      pocketbaseUrl: '',
      public: { pocketbaseUrl: 'http://localhost:8090' }
    }))

    const { resolveServerPocketBaseUrl } = await import('../../../server/utils/resolvePbUrl')

    expect(resolveServerPocketBaseUrl()).toBe('http://localhost:8090')
  })
})
