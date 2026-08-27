import { describe, expect, it } from 'vitest'
import { buildSeoIssueBreakdown, totalOpenSeoIssues } from '~/utils/seoIssueBreakdown'

describe('seoIssueBreakdown', () => {
  it('builds category rows with site-scoped links', () => {
    const rows = buildSeoIssueBreakdown({
      technical: 4,
      crawlability: 2,
      content: 3,
      siteId: 'site-1'
    })

    expect(rows.map(row => row.id)).toEqual(['technical', 'crawlability', 'content'])
    expect(rows[0]?.to).toBe('/sites/site-1/seo/technical')
    expect(rows[1]?.to).toBe('/sites/site-1/seo/technical?subcategory=crawlability')
    expect(rows[2]?.to).toBe('/sites/site-1/seo/content')
    expect(totalOpenSeoIssues({ technical: 4, crawlability: 2, content: 3 })).toBe(9)
  })
})
