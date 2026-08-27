import { describe, expect, it } from 'vitest'
import { CrawlDiagnostics } from '../../../src/crawler/crawlDiagnostics.js'
import { evaluateScanQuality } from '../../../src/crawler/scanQuality.js'
import type { PageResult } from '../../../src/crawler/siteCrawler.js'

function page(overrides: Partial<PageResult> = {}): PageResult {
  return {
    url: 'https://example.com',
    title: 'Example',
    statusCode: 200,
    wordCount: 10,
    readabilityScore: 60,
    readabilityScores: {} as PageResult['readabilityScores'],
    crawlDepth: 0,
    htmlSnapshot: '<html></html>',
    htmlSizeBytes: 20,
    issues: [],
    brokenLinks: [],
    linkHrefs: [],
    spelling: [],
    inventory: [],
    ...overrides
  }
}

describe('evaluateScanQuality', () => {
  it('treats an empty crawl as untrusted', () => {
    const diag = new CrawlDiagnostics(false)
    diag.recordAttempt()
    diag.recordException('https://example.com', new Error('net::ERR_CONNECTION_REFUSED'))
    const quality = evaluateScanQuality(diag, [])
    expect(quality.trusted).toBe(false)
    expect(quality.pages_saved).toBe(0)
  })

  it('treats a healthy crawl as trusted', () => {
    const diag = new CrawlDiagnostics(false)
    diag.recordAttempt()
    diag.recordSuccess()
    const quality = evaluateScanQuality(diag, [page()])
    expect(quality.trusted).toBe(true)
    expect(quality.axe_failed).toBe(0)
  })

  it('is untrusted when most axe runs fail', () => {
    const diag = new CrawlDiagnostics(false)
    diag.recordAttempt()
    diag.recordAttempt()
    diag.recordSuccess()
    diag.recordSuccess()
    const quality = evaluateScanQuality(diag, [
      page({ url: 'https://example.com/a', a11yFailed: true }),
      page({ url: 'https://example.com/b', a11yFailed: true })
    ])
    expect(quality.trusted).toBe(false)
    expect(quality.axe_failed).toBe(2)
  })

  it('is untrusted for pages-mode scans', () => {
    const diag = new CrawlDiagnostics(false)
    diag.recordAttempt()
    diag.recordSuccess()
    const quality = evaluateScanQuality(diag, [page()], { mode: 'pages' })
    expect(quality.trusted).toBe(false)
    expect(quality.reason).toMatch(/Pages-mode/i)
  })

  it('is untrusted when coverage is far below the last trusted scan', () => {
    const diag = new CrawlDiagnostics(false)
    diag.recordAttempt()
    diag.recordSuccess()
    const quality = evaluateScanQuality(diag, [page(), page({ url: 'https://example.com/b' })], {
      mode: 'full',
      previousTrustedPages: 40
    })
    expect(quality.trusted).toBe(false)
    expect(quality.reason).toMatch(/Low coverage/i)
  })
})
