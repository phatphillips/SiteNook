import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { parseRobotsTxt } from '../../../src/crawler/robots.js'
import { runCrawlabilityAudit } from '../../../src/seo/crawlabilityAudit.js'

describe('parseRobotsTxt integration', () => {
  it('flags missing sitemap directive', () => {
    const parsed = parseRobotsTxt('User-agent: *\nDisallow:\n')
    expect(parsed.sitemapUrls).toHaveLength(0)
  })
})

describe('runCrawlabilityAudit', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch)
  })

  it('creates issues and audit snapshot for missing files', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/robots.txt')) {
        return new Response('not found', { status: 404 })
      }
      if (String(url).endsWith('/sitemap.xml')) {
        return new Response('not found', { status: 404 })
      }
      if (String(url).endsWith('/llms.txt')) {
        return new Response('not found', { status: 404 })
      }
      return new Response('', { status: 404 })
    })

    const result = await runCrawlabilityAudit({
      origin: 'https://example.com',
      startUrl: 'https://example.com/',
      crawledPages: []
    })

    expect(result.audit.robots.found).toBe(false)
    expect(result.audit.llms.found).toBe(false)
    expect(result.audit.sitemap.found).toBe(false)
    expect(result.issues.some(i => i.rule_id === 'robots-unreachable')).toBe(true)
    expect(result.issues.some(i => i.rule_id === 'llms-missing')).toBe(true)
    expect(result.issues.some(i => i.rule_id === 'sitemap-unreachable')).toBe(true)
    expect(result.audit.robots.summary).toContain('Not reachable')
  })

  it('reports healthy robots and sitemap', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2026-01-01</lastmod></url>
  <url><loc>https://example.com/about</loc><lastmod>2026-02-01</lastmod></url>
</urlset>`

    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/robots.txt')) {
        return new Response(`User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml`, { status: 200 })
      }
      if (String(url).includes('sitemap.xml')) {
        return new Response(sitemapXml, { status: 200 })
      }
      if (String(url).endsWith('/llms.txt')) {
        return new Response('# Example\n\nA site summary with enough description text here.\n\n- [Home](https://example.com/)', { status: 200 })
      }
      if (String(url).endsWith('/')) {
        return new Response('', { status: 200 })
      }
      if (String(url).endsWith('/about')) {
        return new Response('', { status: 200 })
      }
      return new Response('', { status: 404 })
    })

    const result = await runCrawlabilityAudit({
      origin: 'https://example.com',
      startUrl: 'https://example.com/',
      crawledPages: [
        { url: 'https://example.com/', seoSnapshot: { jsonLdTypes: [], jsonLdErrors: [], headings: [] } }
      ]
    })

    expect(result.audit.robots.found).toBe(true)
    expect(result.audit.robots.declaresSitemap).toBe(true)
    expect(result.audit.sitemap.found).toBe(true)
    expect(result.audit.sitemap.validXml).toBe(true)
    expect(result.audit.llms.found).toBe(true)
    expect(result.audit.llms.valid).toBe(true)
    expect(result.issues.some(i => i.rule_id === 'robots-unreachable')).toBe(false)
    expect(result.issues.some(i => i.rule_id === 'llms-missing')).toBe(false)
  })
})
