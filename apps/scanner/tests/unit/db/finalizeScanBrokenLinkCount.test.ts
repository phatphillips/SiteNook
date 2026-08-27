import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/db/pocketbaseClient.js', () => ({
  batchCreate: vi.fn(),
  getPocketBase: vi.fn(),
  withPocketBaseRetry: async (fn: () => Promise<unknown>) => fn()
}))
vi.mock('../../../src/search/searchIndexer.js', () => ({
  reconcileSiteWebpageSearchIndex: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('../../../src/accessibility/reconcileSiteCurrentA11y.js', () => ({
  reconcileSiteCurrentA11y: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('../../../src/accessibility/diffEngine.js', () => ({
  diffScans: vi.fn()
}))
vi.mock('../../../src/crawler/siteCrawler.js', () => ({
  aggregateScoresForScan: vi.fn(() => ({
    score_overall: 80,
    score_a: 80,
    score_aa: 80,
    score_aaa: 80,
    score_best_practices: 80,
    score_qa: 70,
    score_denominators: { elements: {}, qa: {} }
  })),
  logScoreFieldsBeforePbWrite: vi.fn(),
  scanScoreFieldsFromAggregate: vi.fn((agg: Record<string, unknown>) => agg)
}))
vi.mock('../../../src/seo/runSeoSitePass.js', () => ({
  runSeoSitePass: vi.fn().mockReturnValue([])
}))
vi.mock('../../../src/seo/crawlabilityAudit.js', () => ({
  runCrawlabilityAudit: vi.fn().mockResolvedValue(null)
}))
vi.mock('../../../src/seo/seoScore.js', () => ({
  calculateSeoScores: vi.fn(() => ({}))
}))
vi.mock('../../../src/accessibility/buildA11ySummary.js', () => ({
  buildA11ySummary: vi.fn(() => ({ open_issue_count: 0 })),
  issuesFromPageResults: vi.fn(() => [])
}))

import { finalizeScan } from '../../../src/db/finalizeScan.js'

function issue(status: 'open' | 'dismissed' = 'open') {
  return {
    rule_id: 'image-alt',
    css_selector: 'img',
    wcag_level: 'A',
    impact: 'serious',
    element_type: 'image',
    status
  }
}

describe('finalizeScan broken_link_count', () => {
  it('counts open issues from in-memory pages and broken links from totalItems', async () => {
    const accessibilityGetFullList = vi.fn().mockResolvedValue([{ id: 'i1' }, { id: 'i2' }])
    const pb = {
      collection: vi.fn((name: string) => {
        if (name === 'pages') {
          return { getFullList: vi.fn().mockResolvedValue([]) }
        }
        if (name === 'accessibility_issues') {
          return { getFullList: accessibilityGetFullList }
        }
        if (name === 'qa_broken_links') {
          return { getList: vi.fn().mockResolvedValue({ totalItems: 9 }) }
        }
        if (name === 'scans') {
          return { getList: vi.fn().mockResolvedValue({ items: [] }) }
        }
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          getList: vi.fn().mockResolvedValue({ items: [], totalItems: 0 })
        }
      })
    }

    const result = await finalizeScan(pb as never, {
      scanId: 'scan-1',
      siteId: 'site-1',
      startUrl: 'https://example.com',
      pages: [
        {
          url: 'https://example.com/',
          issues: [issue('open'), issue('open'), issue('dismissed')]
        }
      ] as never,
      inboundLinks: new Map(),
      siteSettings: {
        checkSeo: false,
        depthWeightedScoring: false
      } as never,
      diffFromPrevious: false,
      runSitePass: false
    })

    expect(result.openIssueCount).toBe(2)
    expect(result.brokenLinkCount).toBe(9)
    expect(accessibilityGetFullList).not.toHaveBeenCalled()
  })
})
