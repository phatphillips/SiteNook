import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signSnapshotTicket } from '../../../server/utils/snapshotTicket'
import { clearLivePageHtmlCache } from '../../../server/utils/fetchLivePageHtml'

const { mockGetPbAdmin, mockFetch } = vi.hoisted(() => ({
  mockGetPbAdmin: vi.fn(),
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
    setHeader: (event: { context?: { responseHeaders?: Record<string, string> } }, key: string, value: string) => {
      if (!event.context) event.context = {}
      event.context.responseHeaders ||= {}
      event.context.responseHeaders[key] = value
    }
  }
})

vi.mock('../../../server/utils/pbAdmin', () => ({
  getPbAdmin: mockGetPbAdmin
}))

vi.stubGlobal('useRuntimeConfig', () => ({
  previewSigningSecret: process.env.NUXT_PREVIEW_SIGNING_SECRET || '',
  licenceSigningSecret: process.env.NUXT_LICENCE_SIGNING_SECRET || '',
  public: { appUrl: 'http://localhost:3500' }
}))

async function loadHandler() {
  return (await import('../../../server/api/sites/[siteId]/pages/[pageId]/live-preview.get')).default as (
    event: unknown
  ) => Promise<unknown>
}

function pageEvent(ticket: string) {
  return {
    context: {
      params: { siteId: 'site-1', pageId: 'page-1' },
      query: { ticket },
      responseHeaders: {} as Record<string, string>
    }
  }
}

describe('page live preview API', () => {
  const previousSecret = process.env.NUXT_PREVIEW_SIGNING_SECRET

  beforeEach(() => {
    mockGetPbAdmin.mockReset()
    mockFetch.mockReset()
    clearLivePageHtmlCache()
    process.env.NUXT_PREVIEW_SIGNING_SECRET = 'test-preview-signing-secret'
  })

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.NUXT_PREVIEW_SIGNING_SECRET
    else process.env.NUXT_PREVIEW_SIGNING_SECRET = previousSecret
  })

  it('uses stored HTML when live fetch fails', async () => {
    const ticket = signSnapshotTicket({
      uid: 'user-1',
      siteId: 'site-1',
      pageId: 'page-1'
    })
    mockGetPbAdmin.mockResolvedValue({
      authStore: { token: 'admin-token' },
      files: { getUrl: vi.fn() },
      collection: vi.fn(() => ({
        getOne: vi.fn(async () => ({
          id: 'page-1',
          site: 'site-1',
          url: 'https://example.gov/page',
          html_snapshot: '<html><body><p>from snapshot</p></body></html>'
        }))
      }))
    })
    mockFetch.mockResolvedValue({ ok: false })

    const handler = await loadHandler()
    const event = pageEvent(ticket)
    const html = await handler(event)
    expect(String(html)).toContain('from snapshot')
    expect(event.context.responseHeaders['Content-Security-Policy']).toContain("script-src https: http:")
  })

  it('prefers live HTML over a styled freeze snapshot', async () => {
    const ticket = signSnapshotTicket({
      uid: 'user-1',
      siteId: 'site-1',
      pageId: 'page-1'
    })
    mockGetPbAdmin.mockResolvedValue({
      authStore: { token: 'admin-token' },
      files: { getUrl: vi.fn() },
      collection: vi.fn(() => ({
        getOne: vi.fn(async () => ({
          id: 'page-1',
          site: 'site-1',
          url: 'https://example.gov/page',
          html_snapshot: '<html class="ast-desktop"><style>:root{--ast-global-color-0:#123}</style><body><p>from snapshot</p></body></html>'
        }))
      }))
    })
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from(
        '<html><head></head><body><h1>Teachers live</h1><script>window.ok=true</script></body></html>'
      )
    })

    const handler = await loadHandler()
    const html = await handler(pageEvent(ticket))
    expect(String(html)).toContain('Teachers live')
    expect(String(html)).toContain('<script>window.ok=true</script>')
    expect(String(html)).not.toContain('from snapshot')
  })

  it('uses cached live HTML when it is already available', async () => {
    const ticket = signSnapshotTicket({
      uid: 'user-1',
      siteId: 'site-1',
      pageId: 'page-1'
    })
    mockGetPbAdmin.mockResolvedValue({
      authStore: { token: 'admin-token' },
      files: { getUrl: vi.fn() },
      collection: vi.fn(() => ({
        getOne: vi.fn(async () => ({
          id: 'page-1',
          site: 'site-1',
          url: 'https://example.gov/page',
          html_snapshot: '<p>truncated</p>'
        }))
      }))
    })
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from(
        '<html><head></head><body><h1>Home</h1><script>window.ok=true</script></body></html>'
      )
    })
    const { fetchLivePageHtml } = await import('../../../server/utils/fetchLivePageHtml')
    await fetchLivePageHtml('https://example.gov/page')

    const handler = await loadHandler()
    const html = await handler(pageEvent(ticket))
    expect(String(html)).toContain('<h1>Home</h1>')
    expect(String(html)).not.toContain('truncated')
  })

  it('404s when the page belongs to another site', async () => {
    const ticket = signSnapshotTicket({
      uid: 'user-1',
      siteId: 'site-1',
      pageId: 'page-1'
    })
    mockGetPbAdmin.mockResolvedValue({
      collection: vi.fn(() => ({
        getOne: vi.fn(async () => ({
          id: 'page-1',
          site: 'other-site',
          url: 'https://example.gov/page'
        }))
      }))
    })

    const handler = await loadHandler()
    await expect(handler(pageEvent(ticket))).rejects.toMatchObject({ statusCode: 404 })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
