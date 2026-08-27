import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireSiteAccess, mockFetch } = vi.hoisted(() => ({
  mockRequireSiteAccess: vi.fn(),
  mockFetch: vi.fn()
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('fetch', mockFetch)

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    getRouterParam: (event: { context?: { params?: Record<string, string> } }, key: string) => event.context?.params?.[key],
    getQuery: (event: { context?: { query?: Record<string, unknown> } }) => event.context?.query ?? {},
    getHeader: (event: { context?: { headers?: Record<string, string> } }, key: string) => event.context?.headers?.[key.toLowerCase()],
    setHeader: (event: { context?: { responseHeaders?: Record<string, string> } }, key: string, value: string) => {
      if (!event.context) event.context = {}
      event.context.responseHeaders ||= {}
      event.context.responseHeaders[key] = value
    }
  }
})

vi.mock('../../../server/utils/requireSiteAccess', () => ({
  requireSiteAccess: mockRequireSiteAccess
}))

describe('content export API', () => {
  beforeEach(() => {
    mockRequireSiteAccess.mockReset()
    mockFetch.mockReset()
  })

  it('returns markdown bytes for a single blob', async () => {
    const pb = {
      files: {
        getUrl: vi.fn(() => 'https://files.test/body.md')
      },
      collection: vi.fn((name: string) => {
        if (name === 'page_content_blobs') {
          return {
            getOne: vi.fn(async () => ({ id: 'blob-1', site: 'site-1', body: ['body.md'] }))
          }
        }
        if (name === 'page_content_observations') {
          return {
            getList: vi.fn(async () => ({ items: [{ url: 'https://example.com/blog/post', title: 'Post' }] }))
          }
        }
        throw new Error(`unexpected collection ${name}`)
      })
    }
    mockRequireSiteAccess.mockResolvedValue({ pb })
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('# Post', 'utf8')
    })

    const handler = (await import('../../../server/api/sites/[siteId]/content/export.get')).default as (event: unknown) => Promise<unknown>
    const event = {
      context: {
        params: { siteId: 'site-1' },
        query: { blobId: 'blob-1' },
        headers: { authorization: 'Bearer token-1' },
        responseHeaders: {}
      }
    }

    const result = await handler(event)
    expect(Buffer.isBuffer(result)).toBe(true)
    expect((result as Buffer).toString('utf8')).toContain('# Post')
  })

  it('returns a ZIP for multiple blobs', async () => {
    const pb = {
      files: {
        getUrl: vi.fn((record: { id?: string }) => `https://files.test/${record.id}.md`)
      },
      collection: vi.fn((name: string) => {
        if (name === 'page_content_blobs') {
          return {
            getOne: vi.fn(async (id: string) => ({ id, site: 'site-1', body: [`${id}.md`] }))
          }
        }
        if (name === 'page_content_observations') {
          return {
            getList: vi.fn(async () => ({ items: [{ url: 'https://example.com/about', title: 'About' }] }))
          }
        }
        throw new Error(`unexpected collection ${name}`)
      })
    }
    mockRequireSiteAccess.mockResolvedValue({ pb })
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('# Markdown', 'utf8')
    })

    const handler = (await import('../../../server/api/sites/[siteId]/content/export.get')).default as (event: unknown) => Promise<unknown>
    const event = {
      context: {
        params: { siteId: 'site-1' },
        query: { blobIds: 'blob-1,blob-2' },
        headers: { authorization: 'Bearer token-1' },
        responseHeaders: {}
      }
    }

    const result = await handler(event)
    expect(Buffer.isBuffer(result)).toBe(true)
    expect((result as Buffer).subarray(0, 2).toString('utf8')).toBe('PK')
  })
})
