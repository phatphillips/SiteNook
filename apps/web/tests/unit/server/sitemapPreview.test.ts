import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError, createEvent } from 'h3'

const { mockRequirePbUser, mockFetch } = vi.hoisted(() => ({
  mockRequirePbUser: vi.fn(),
  mockFetch: vi.fn()
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requirePbUser', mockRequirePbUser)
vi.stubGlobal('getQuery', () => ({ url: 'https://example.com/sitemap.xml' }))
vi.stubGlobal('createError', createError)
vi.stubGlobal('fetch', mockFetch)

describe('sitemap-preview API', () => {
  beforeEach(() => {
    mockRequirePbUser.mockReset()
    mockFetch.mockReset()
  })

  it('returns 401 when the caller is not authenticated', async () => {
    mockRequirePbUser.mockRejectedValue(
      createError({ statusCode: 401, statusMessage: 'Authentication required' })
    )

    const handler = (await import('../../../server/api/sitemap-preview.get')).default
    const event = createEvent({
      method: 'GET',
      url: '/api/sitemap-preview?url=https://example.com/sitemap.xml'
    })

    await expect((handler as (event: unknown) => Promise<unknown>)(event)).rejects.toMatchObject({
      statusCode: 401
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns parsed sitemap data for an authenticated user', async () => {
    mockRequirePbUser.mockResolvedValue({ id: 'user-1' })
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '<urlset><url><loc>https://example.com/</loc></url></urlset>'
    })

    const handler = (await import('../../../server/api/sitemap-preview.get')).default
    const event = createEvent({
      method: 'GET',
      url: '/api/sitemap-preview?url=https://example.com/sitemap.xml'
    })

    await expect((handler as (event: unknown) => Promise<unknown>)(event)).resolves.toEqual({
      count: 1,
      urls: ['https://example.com/']
    })
  })
})
