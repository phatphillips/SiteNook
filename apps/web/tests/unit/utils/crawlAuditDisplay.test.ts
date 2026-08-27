import { describe, expect, it } from 'vitest'
import { buildSiteFileRows, issueForCrawlFile } from '../../../app/utils/crawlAuditDisplay'
import type { SeoCrawlAudit, SeoIssue } from '../../../app/types/sitenook'

const sampleAudit: SeoCrawlAudit = {
  robots: {
    found: true,
    url: 'https://example.com/robots.txt',
    declaresSitemap: true,
    sitemapUrls: ['https://example.com/sitemap.xml'],
    summary: 'Declares sitemap · Googlebot allowed',
    aiBots: { Googlebot: 'allowed', 'OAI-SearchBot': 'allowed', PerplexityBot: 'allowed' }
  },
  sitemap: {
    found: true,
    url: 'https://example.com/sitemap.xml',
    discoveredVia: 'robots',
    validXml: true,
    urlCount: 10,
    isIndex: false,
    specialized: {},
    summary: '10 URLs · valid XML · via robots.txt'
  },
  llms: {
    found: false,
    url: 'https://example.com/llms.txt',
    valid: false,
    summary: 'Not found at /llms.txt'
  },
  checkedAt: '2026-06-18T00:00:00.000Z'
}

const sampleIssues: SeoIssue[] = [
  {
    id: '1',
    scan: 's1',
    site: 'site1',
    rule_id: 'llms-missing',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'moderate',
    status: 'open',
    title: 'llms.txt not found',
    description: '',
    recommendation: ''
  }
]

describe('crawlAuditDisplay', () => {
  it('builds three site file rows', () => {
    const rows = buildSiteFileRows(sampleAudit, sampleIssues)
    expect(rows).toHaveLength(3)
    expect(rows[0]?.label).toBe('robots.txt')
    expect(rows[2]?.status).toBe('red')
  })

  it('links llms issue to file row', () => {
    const issue = issueForCrawlFile(sampleIssues, 'llms')
    expect(issue?.rule_id).toBe('llms-missing')
  })
})
