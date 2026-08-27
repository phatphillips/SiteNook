import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  CrawlDiagnostics,
  classifyCrawlError,
  isCrawlDebugEnabled
} from '../../../src/crawler/crawlDiagnostics.js'

describe('crawlDiagnostics', () => {
  afterEach(() => {
    delete process.env.SCANNER_CRAWL_DEBUG
  })

  it('classifies timeout errors', () => {
    expect(classifyCrawlError(new Error('Timeout 30000ms exceeded'))).toBe('timeout')
  })

  it('logs summary with attempt vs success counts', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const diag = new CrawlDiagnostics(false)
    diag.recordSeed(160)
    diag.recordAttempt()
    diag.recordAttempt()
    diag.recordSuccess()
    diag.recordHttpError(404, 'https://example.com/missing')
    diag.recordException('https://example.com/slow', new Error('Timeout'))
    diag.finish({
      stopReason: 'queue_empty',
      queueRemaining: 0,
      visitedCount: 160,
      resultsCount: 29,
      maxPages: 500
    })

    const output = log.mock.calls.map(c => String(c[0])).join('\n')
    expect(output).toContain('Crawl diagnostics')
    expect(output).toContain('Attempts: 2 (1 OK, 1 failed')
    expect(output).toContain('HTTP errors: 404: 1')
    expect(output).toContain('Load/scan errors: timeout: 1')
    log.mockRestore()
  })

  it('records 403 and challenge URLs as unscanned', () => {
    const diag = new CrawlDiagnostics(false)
    diag.recordHttpError(403, 'https://example.com/a')
    diag.recordHttpError(404, 'https://example.com/missing')
    diag.recordUnscanned('https://example.com/challenge')
    expect(diag.unscannedUrls).toEqual([
      'https://example.com/a',
      'https://example.com/challenge'
    ])
  })

  it('tips when the start URL is blocked by robots.txt', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const diag = new CrawlDiagnostics(false)
    diag.recordSeed(1)
    diag.recordDequeueSkip('robots')
    diag.finish({
      stopReason: 'queue_empty',
      queueRemaining: 0,
      visitedCount: 0,
      resultsCount: 0,
      maxPages: 10
    })
    const output = log.mock.calls.map(c => String(c[0])).join('\n')
    expect(output).toContain('blocked by robots.txt')
    expect(output).toContain('Respect robots.txt')
    log.mockRestore()
  })

  it('respects SCANNER_CRAWL_DEBUG env', () => {
    process.env.SCANNER_CRAWL_DEBUG = '1'
    expect(isCrawlDebugEnabled()).toBe(true)
  })
})

describe('MIN_SITEMAP_SEED_URLS export', () => {
  it('is exported from crawlSeeds', async () => {
    const { MIN_SITEMAP_SEED_URLS: fromSeeds } = await import('../../../src/crawler/crawlSeeds.js')
    expect(fromSeeds).toBeGreaterThan(0)
  })
})
