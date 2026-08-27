import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

const { mockAuthRefresh } = vi.hoisted(() => ({
  mockAuthRefresh: vi.fn()
}))

vi.mock('pocketbase', () => ({
  default: class MockPocketBase {
    authStore = { save: vi.fn() }
    autoCancellation = vi.fn()
    collection() {
      return { authRefresh: mockAuthRefresh }
    }
  }
}))

describe('requirePbUser', () => {
  beforeEach(async () => {
    mockAuthRefresh.mockReset()
    vi.stubGlobal('useRuntimeConfig', () => ({
      pocketbaseUrl: 'http://pocketbase:8090',
      public: { pocketbaseUrl: 'http://localhost:8090' }
    }))
    const { clearPbUserAuthCache } = await import('../../../server/utils/requirePbUser')
    clearPbUserAuthCache()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const { requirePbUser } = await import('../../../server/utils/requirePbUser')
    const event = createEvent({ method: 'GET', url: '/api/sitemap-preview' })

    await expect(requirePbUser(event)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  })

  it('returns 401 when token refresh fails', async () => {
    mockAuthRefresh.mockRejectedValue(new Error('invalid token'))
    const { requirePbUser } = await import('../../../server/utils/requirePbUser')
    const event = createEvent({
      method: 'GET',
      url: '/api/sitemap-preview',
      headers: { authorization: 'Bearer bad-token' }
    })

    await expect(requirePbUser(event)).rejects.toMatchObject({
      statusCode: 401
    })
  })

  it('returns the user record when token refresh succeeds', async () => {
    const record = { id: 'user-1', email: 'user@test', collectionName: 'users' }
    mockAuthRefresh.mockResolvedValue({ record })
    const { requirePbUser } = await import('../../../server/utils/requirePbUser')
    const event = createEvent({
      method: 'GET',
      url: '/api/sitemap-preview',
      headers: { authorization: 'Bearer good-token' }
    })

    await expect(requirePbUser(event)).resolves.toEqual(record)
  })

  it('skips authRefresh on cache hit within TTL', async () => {
    const record = { id: 'user-1', email: 'user@test', collectionName: 'users' }
    mockAuthRefresh.mockResolvedValue({ record })
    const { requirePbUser } = await import('../../../server/utils/requirePbUser')
    const event = createEvent({
      method: 'GET',
      url: '/api/sitemap-preview',
      headers: { authorization: 'Bearer cached-token' }
    })

    await expect(requirePbUser(event)).resolves.toEqual(record)
    await expect(requirePbUser(event)).resolves.toEqual(record)
    expect(mockAuthRefresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes again after cache is cleared', async () => {
    const record = { id: 'user-1', email: 'user@test', collectionName: 'users' }
    mockAuthRefresh.mockResolvedValue({ record })
    const { requirePbUser, clearPbUserAuthCache } = await import('../../../server/utils/requirePbUser')
    const event = createEvent({
      method: 'GET',
      url: '/api/sitemap-preview',
      headers: { authorization: 'Bearer refresh-again' }
    })

    await requirePbUser(event)
    clearPbUserAuthCache()
    await requirePbUser(event)
    expect(mockAuthRefresh).toHaveBeenCalledTimes(2)
  })
})
