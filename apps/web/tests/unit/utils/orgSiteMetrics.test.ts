import { describe, expect, it } from 'vitest'
import { siteIssueBarPoints } from '~/utils/orgSiteMetrics'
import type { SiteDashboardSnapshot } from '~/utils/dashboardAggregates'

function snapshot(partial: Partial<SiteDashboardSnapshot> & Pick<SiteDashboardSnapshot, 'siteId' | 'siteName'>): SiteDashboardSnapshot {
  return {
    siteUrl: 'https://example.com',
    accessibilityScore: null,
    qaScore: null,
    seoScore: null,
    openA11yIssues: 0,
    openQaIssues: 0,
    openSeoIssues: 0,
    brokenLinkCount: 0,
    misspellingCount: 0,
    technicalSeoCount: 0,
    contentSeoCount: 0,
    lastScanAt: null,
    ...partial
  }
}

describe('siteIssueBarPoints', () => {
  it('orders sites fewest → most open issues', () => {
    const points = siteIssueBarPoints(
      [
        snapshot({ siteId: 'a', siteName: 'Alpha', openA11yIssues: 20, accessibilityScore: 50 }),
        snapshot({ siteId: 'b', siteName: 'Beta', openA11yIssues: 2, accessibilityScore: 90 }),
        snapshot({ siteId: 'c', siteName: 'Gamma', openA11yIssues: 10, accessibilityScore: 70 })
      ],
      s => s.openA11yIssues,
      s => `/sites/${s.siteId}/accessibility/issues`
    )

    expect(points.map(p => p.siteId)).toEqual(['b', 'c', 'a'])
    expect(points[0]?.href).toBe('/sites/b/accessibility/issues')
  })
})
