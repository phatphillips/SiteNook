import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signSnapshotTicket } from '../../../server/utils/snapshotTicket'

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
  licenceSigningSecret: process.env.NUXT_LICENCE_SIGNING_SECRET || ''
}))

async function loadHandler() {
  return (await import('../../../server/api/sites/[siteId]/pages/[pageId]/snapshot.get')).default as (
    event: unknown
  ) => Promise<unknown>
}

describe('page snapshot document API', () => {
  const previousSecret = process.env.NUXT_PREVIEW_SIGNING_SECRET

  beforeEach(() => {
    mockGetPbAdmin.mockReset()
    mockFetch.mockReset()
    process.env.NUXT_PREVIEW_SIGNING_SECRET = 'test-preview-signing-secret'
  })

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.NUXT_PREVIEW_SIGNING_SECRET
    else process.env.NUXT_PREVIEW_SIGNING_SECRET = previousSecret
  })

  it('serves sanitized rendered_html with iframe-friendly headers', async () => {
    const ticket = signSnapshotTicket({
      uid: 'user-1',
      siteId: 'site-1',
      pageId: 'page-1'
    })
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '<html><head></head><body><p>Hello</p><script>alert(1)</script></body></html>'
    })
    mockGetPbAdmin.mockResolvedValue({
      authStore: { token: 'admin-token' },
      files: { getUrl: vi.fn(() => 'https://files.test/snapshot.html') },
      collection: vi.fn(() => ({
        getOne: vi.fn(async () => ({
          id: 'page-1',
          site: 'site-1',
          url: 'https://example.gov/page',
          rendered_html: 'snapshot.html'
        }))
      }))
    })

    const handler = await loadHandler()
    const event = {
      context: {
        params: { siteId: 'site-1', pageId: 'page-1' },
        query: { ticket },
        responseHeaders: {} as Record<string, string>
      }
    }

    const html = await handler(event)
    expect(String(html)).toContain('Hello')
    expect(String(html)).toContain('<base target="_blank" href="https://example.gov/page">')
    expect(String(html)).not.toContain('<script>')
    expect(event.context.responseHeaders['Content-Type']).toBe('text/html; charset=utf-8')
    expect(event.context.responseHeaders['Content-Security-Policy']).toContain("frame-ancestors 'self'")
    expect(event.context.responseHeaders['Cache-Control']).toBe('private, no-store')
    expect(event.context.responseHeaders['X-Frame-Options']).toBe('SAMEORIGIN')
  })

  it('404s when the page belongs to another site', async () => {
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
          site: 'other-site',
          url: 'https://example.gov/page',
          html_snapshot: '<p>nope</p>'
        }))
      }))
    })

    const handler = await loadHandler()
    await expect(handler({
      context: {
        params: { siteId: 'site-1', pageId: 'page-1' },
        query: { ticket },
        responseHeaders: {}
      }
    })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('prefers the rendered_html file when present', async () => {
    const ticket = signSnapshotTicket({
      uid: 'user-1',
      siteId: 'site-1',
      pageId: 'page-1'
    })
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => '<html><head></head><body><h1>From file</h1></body></html>'
    })
    mockGetPbAdmin.mockResolvedValue({
      authStore: { token: 'admin-token' },
      files: { getUrl: vi.fn(() => 'https://files.test/snapshot.html') },
      collection: vi.fn(() => ({
        getOne: vi.fn(async () => ({
          id: 'page-1',
          site: 'site-1',
          url: 'https://example.gov/page',
          rendered_html: 'snapshot.html',
          html_snapshot: '<p>truncated</p>'
        }))
      }))
    })

    const handler = await loadHandler()
    const html = await handler({
      context: {
        params: { siteId: 'site-1', pageId: 'page-1' },
        query: { ticket },
        responseHeaders: {}
      }
    })
    expect(String(html)).toContain('From file')
    expect(String(html)).not.toContain('truncated')
  })

  it('404s when only truncated html_snapshot exists', async () => {
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
          html_snapshot: '<html class="ast-desktop"><head><style>/* trimmed for snapshot storage */</style></head><body><h1>Home</h1></body></html>'
        }))
      }))
    })

    const handler = await loadHandler()
    await expect(handler({
      context: {
        params: { siteId: 'site-1', pageId: 'page-1' },
        query: { ticket },
        responseHeaders: {}
      }
    })).rejects.toMatchObject({ statusCode: 404 })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
