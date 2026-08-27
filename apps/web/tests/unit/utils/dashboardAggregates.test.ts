import { describe, expect, it } from 'vitest'
import {
  aggregateOrgDashboard,
  averageScore,
  buildSiteDashboardSnapshot,
  sortAttentionSites
} from '~/utils/dashboardAggregates'

describe('dashboardAggregates', () => {
  it('averages only finite scores', () => {
    expect(averageScore([80, 90, null])).toBe(85)
    expect(averageScore([null, undefined])).toBeNull()
  })

  it('builds site snapshots and org rollups', () => {
    const snapshots = [
      buildSiteDashboardSnapshot({
        site: { id: 'a', name: 'Alpha', url: 'https://alpha.test' } as never,
        latestScan: { score_overall: 80, score_qa: 70, score_seo: 60, open_issue_count: 4 } as never,
        openA11yIssues: 4,
        openQaIssues: 3,
        openSeoIssues: 2,
        brokenLinkCount: 2,
        misspellingCount: 1,
        technicalSeoCount: 1,
        contentSeoCount: 1
      }),
      buildSiteDashboardSnapshot({
        site: { id: 'b', name: 'Beta', url: 'https://beta.test' } as never,
        latestScan: { score_overall: 60, score_qa: 50, score_seo: 40, open_issue_count: 10 } as never,
        openA11yIssues: 10,
        openQaIssues: 8,
        openSeoIssues: 6,
        brokenLinkCount: 5,
        misspellingCount: 3,
        technicalSeoCount: 4,
        contentSeoCount: 2
      })
    ]

    const aggregates = aggregateOrgDashboard(snapshots)
    expect(aggregates.avgAccessibilityScore).toBe(70)
    expect(aggregates.totalOpenA11yIssues).toBe(14)
    expect(aggregates.totalOpenQaIssues).toBe(11)
    expect(aggregates.totalOpenSeoIssues).toBe(8)
    expect(aggregates.totalBrokenLinks).toBe(7)
    expect(aggregates.totalMisspellings).toBe(4)
    expect(aggregates.totalTechnicalSeoIssues).toBe(5)
    expect(aggregates.totalContentSeoIssues).toBe(3)
  })

  it('sorts attention sites by lowest score then highest issues', () => {
    const snapshots = [
      buildSiteDashboardSnapshot({
        site: { id: 'a', name: 'Alpha', url: 'https://alpha.test' } as never,
        latestScan: { score_overall: 80 } as never,
        openA11yIssues: 2,
        openQaIssues: 0,
        openSeoIssues: 0
      }),
      buildSiteDashboardSnapshot({
        site: { id: 'b', name: 'Beta', url: 'https://beta.test' } as never,
        latestScan: { score_overall: 60 } as never,
        openA11yIssues: 10,
        openQaIssues: 0,
        openSeoIssues: 0
      }),
      buildSiteDashboardSnapshot({
        site: { id: 'c', name: 'Gamma', url: 'https://gamma.test' } as never,
        latestScan: { score_overall: 60 } as never,
        openA11yIssues: 5,
        openQaIssues: 0,
        openSeoIssues: 0
      })
    ]

    const attention = sortAttentionSites(snapshots, 'accessibilityScore', 'openA11yIssues')
    expect(attention.map(site => site.siteId)).toEqual(['b', 'c', 'a'])
  })
})
