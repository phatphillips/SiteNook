import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireSiteAccess } = vi.hoisted(() => ({
  mockRequireSiteAccess: vi.fn()
}))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    getRouterParam: (event: { context?: { params?: Record<string, string> } }, key: string) => event.context?.params?.[key]
  }
})

vi.mock('../../../server/utils/requireSiteAccess', () => ({
  requireSiteAccess: mockRequireSiteAccess
}))

vi.stubGlobal('useRuntimeConfig', () => ({
  previewSigningSecret: process.env.NUXT_PREVIEW_SIGNING_SECRET || '',
  licenceSigningSecret: process.env.NUXT_LICENCE_SIGNING_SECRET || ''
}))

describe('page snapshot ticket API', () => {
  const previousSecret = process.env.NUXT_PREVIEW_SIGNING_SECRET

  beforeEach(() => {
    mockRequireSiteAccess.mockReset()
    process.env.NUXT_PREVIEW_SIGNING_SECRET = 'test-preview-signing-secret'
  })

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.NUXT_PREVIEW_SIGNING_SECRET
    else process.env.NUXT_PREVIEW_SIGNING_SECRET = previousSecret
  })

  it('returns a same-origin snapshot URL only when rendered_html is stored', async () => {
    mockRequireSiteAccess.mockResolvedValue({
      user: { id: 'user-1' },
      pb: {
        collection: vi.fn(() => ({
          getOne: vi.fn(async () => ({
            id: 'page-1',
            site: 'site-1',
            url: 'https://example.gov/page',
            rendered_html: 'snapshot.html',
            html_size_bytes: 1200,
            html_snapshot: '<html><head><style>:root{--ast-global-color-0:#123}</style></head><body><p>Hi</p></body></html>'
          }))
        }))
      }
    })

    const handler = (await import('../../../server/api/sites/[siteId]/pages/[pageId]/snapshot-ticket.get')).default as (
      event: unknown
    ) => Promise<{ livePreviewUrl: string, snapshotUrl: string | null, previewKind: 'html' | 'image' }>
    const result = await handler({
      context: { params: { siteId: 'site-1', pageId: 'page-1' } }
    })
    expect(result.livePreviewUrl).toContain('/api/sites/site-1/pages/page-1/live-preview?ticket=')
    expect(result.snapshotUrl).toContain('/api/sites/site-1/pages/page-1/snapshot?ticket=')
    expect(result.previewKind).toBe('html')
  })

  it('returns a live preview URL even when the page has no HTML snapshot', async () => {
    mockRequireSiteAccess.mockResolvedValue({
      user: { id: 'user-1' },
      pb: {
        collection: vi.fn(() => ({
          getOne: vi.fn(async () => ({
            id: 'page-1',
            site: 'site-1',
            url: 'https://example.gov/page',
            html_size_bytes: 0
          }))
        }))
      }
    })

    const handler = (await import('../../../server/api/sites/[siteId]/pages/[pageId]/snapshot-ticket.get')).default as (
      event: unknown
    ) => Promise<{ livePreviewUrl: string, snapshotUrl: string | null, previewKind: 'html' | 'image' }>
    const result = await handler({
      context: { params: { siteId: 'site-1', pageId: 'page-1' } }
    })
    expect(result.livePreviewUrl).toContain('/api/sites/site-1/pages/page-1/live-preview?ticket=')
    expect(result.snapshotUrl).toBeNull()
    expect(result.previewKind).toBe('image')
  })

  it('falls back to the crawl screenshot when only truncated html_snapshot exists', async () => {
    mockRequireSiteAccess.mockResolvedValue({
      user: { id: 'user-1' },
      pb: {
        collection: vi.fn(() => ({
          getOne: vi.fn(async () => ({
            id: 'page-1',
            site: 'site-1',
            url: 'https://example.gov/page',
            html_size_bytes: 8000,
            html_snapshot: '<html class="ast-desktop"><style>/* trimmed for snapshot storage */</style><body><p>Hi</p></body></html>'
          }))
        }))
      }
    })

    const handler = (await import('../../../server/api/sites/[siteId]/pages/[pageId]/snapshot-ticket.get')).default as (
      event: unknown
    ) => Promise<{ previewKind: 'html' | 'image' }>
    const result = await handler({
      context: { params: { siteId: 'site-1', pageId: 'page-1' } }
    })
    expect(result.previewKind).toBe('image')
  })

  it('falls back to the crawl screenshot when Astra theme CSS variables are missing from html_snapshot', async () => {
    mockRequireSiteAccess.mockResolvedValue({
      user: { id: 'user-1' },
      pb: {
        collection: vi.fn(() => ({
          getOne: vi.fn(async () => ({
            id: 'page-1',
            site: 'site-1',
            url: 'https://example.gov/page',
            html_size_bytes: 8000,
            html_snapshot: '<html class="ast-desktop"><body class="ast-page"><h1>Teachers</h1></body></html>'
          }))
        }))
      }
    })

    const handler = (await import('../../../server/api/sites/[siteId]/pages/[pageId]/snapshot-ticket.get')).default as (
      event: unknown
    ) => Promise<{ previewKind: 'html' | 'image' }>
    const result = await handler({
      context: { params: { siteId: 'site-1', pageId: 'page-1' } }
    })
    expect(result.previewKind).toBe('image')
  })
})
