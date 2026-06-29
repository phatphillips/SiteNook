import { describe, it, expect, afterEach } from 'vitest'
import {
  buildContextOptions,
  DEFAULT_BROWSER_USER_AGENT,
  mergeBrowserHeaders,
  resolveUserAgent
} from '../../../src/crawler/browserProfile.js'
import { buildCrawlTip, CrawlDiagnostics } from '../../../src/crawler/crawlDiagnostics.js'

describe('browserProfile', () => {
  afterEach(() => {
    delete process.env.SCANNER_USER_AGENT
  })

  it('uses a non-headless default user agent', () => {
    expect(DEFAULT_BROWSER_USER_AGENT).not.toMatch(/HeadlessChrome/i)
    expect(resolveUserAgent(null)).toBe(DEFAULT_BROWSER_USER_AGENT)
  })

  it('prefers config and env user agent', () => {
    process.env.SCANNER_USER_AGENT = 'CustomBot/1.0'
    expect(resolveUserAgent('FromConfig/2.0')).toBe('FromConfig/2.0')
    expect(resolveUserAgent(null)).toBe('CustomBot/1.0')
  })

  it('merges default browser headers under custom headers', () => {
    const headers = mergeBrowserHeaders({ 'X-Site-Token': 'abc' })
    expect(headers['Accept-Language']).toBeTruthy()
    expect(headers['X-Site-Token']).toBe('abc')
  })

  it('buildContextOptions includes locale and user agent', () => {
    const opts = buildContextOptions({})
    expect(opts.userAgent).toBe(DEFAULT_BROWSER_USER_AGENT)
    expect(opts.locale).toBeTruthy()
    expect(opts.timezoneId).toBeTruthy()
  })
})

describe('buildCrawlTip', () => {
  it('suggests WAF guidance when 403 dominates', () => {
    const diag = new CrawlDiagnostics(false)
    diag.recordSeed(160)
    diag.attempted = 200
    diag.succeeded = 14
    diag.httpErrors.set(403, 186)
    const tip = buildCrawlTip(diag)
    expect(tip).toMatch(/403/)
    expect(tip).toMatch(/WAF|blocking/i)
  })
})
