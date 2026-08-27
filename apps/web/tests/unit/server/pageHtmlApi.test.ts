import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireSiteAccess } = vi.hoisted(() => ({
  mockRequireSiteAccess: vi.fn()
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    getRouterParam: (event: { context?: { params?: Record<string, string> } }, key: string) => event.context?.params?.[key],
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

describe('page HTML snapshot API', () => {
  beforeEach(() => {
    mockRequireSiteAccess.mockReset()
  })

  it('returns the stored html_snapshot for a page on the site', async () => {
    const getOne = vi.fn(async () => ({
      id: 'page-1',
      site: 'site-1',
      html_snapshot: '<html><body>Hello</body></html>'
    }))
    mockRequireSiteAccess.mockResolvedValue({
      pb: {
        collection: vi.fn(() => ({ getOne }))
      }
    })

    const handler = (await import('../../../server/api/sites/[siteId]/content/pages/[pageId]/html.get')).default as (
      event: unknown
    ) => Promise<unknown>
    const event = {
      context: {
        params: { siteId: 'site-1', pageId: 'page-1' },
        responseHeaders: {} as Record<string, string>
      }
    }

    const result = await handler(event)
    expect(result).toBe('<html><body>Hello</body></html>')
    expect(event.context.responseHeaders['Content-Type']).toBe('text/html; charset=utf-8')
    expect(getOne).toHaveBeenCalledWith('page-1', { fields: 'id,site,html_snapshot' })
  })

  it('404s when the page belongs to another site', async () => {
    mockRequireSiteAccess.mockResolvedValue({
      pb: {
        collection: vi.fn(() => ({
          getOne: vi.fn(async () => ({ id: 'page-1', site: 'other-site', html_snapshot: '<p>nope</p>' }))
        }))
      }
    })

    const handler = (await import('../../../server/api/sites/[siteId]/content/pages/[pageId]/html.get')).default as (
      event: unknown
    ) => Promise<unknown>
    const event = {
      context: {
        params: { siteId: 'site-1', pageId: 'page-1' },
        responseHeaders: {}
      }
    }

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 })
  })
})
