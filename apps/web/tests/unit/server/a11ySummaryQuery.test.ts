import { describe, expect, it } from 'vitest'
import type { A11ySummary } from '~/utils/a11ySummary'
import { queryIssuesFromSummary } from '../../../server/utils/a11ySummaryQuery'
import { getDefaultSiteSettings } from '~/utils/siteSettings'

const summary: A11ySummary = {
  generated_at: '2026-01-01T00:00:00.000Z',
  page_count: 3,
  open_issue_count: 4,
  by_severity: { critical: 1, serious: 2, moderate: 0, minor: 1 },
  by_level: { A: 1, AA: 3, AAA: 0 },
  site_target: {
    wcagVersion: '2.2',
    wcagConformance: 'AA',
    ariaConformance: true,
    bestPractices: true,
    includeIssues: true,
    includePotentialIssues: true
  },
  by_rule: [
    {
      rule_id: 'color-contrast',
      wcag_level: 'AA',
      impact: 'serious',
      open_count: 2,
      dismissed_count: 0,
      page_count: 2,
      points_to_gain: 5,
      sample_page_urls: ['https://example.com/a'],
      description: 'Elements must have sufficient color contrast'
    },
    {
      rule_id: 'image-alt',
      wcag_level: 'A',
      impact: 'critical',
      open_count: 2,
      dismissed_count: 0,
      page_count: 1,
      points_to_gain: 8,
      sample_page_urls: ['https://example.com/a'],
      description: 'Images must have alternate text'
    }
  ]
}

describe('queryIssuesFromSummary', () => {
  it('returns paginated items and site-target totals', () => {
    const result = queryIssuesFromSummary(summary, { statuses: ['open'] }, getDefaultSiteSettings())
    expect(result.openUniqueCount).toBe(2)
    expect(result.openOccurrencesCount).toBe(4)
    expect(result.total).toBe(2)
    expect(result.items).toHaveLength(2)
    expect(result.ruleStats['color-contrast']).toEqual({ pages: 2, occurrences: 2 })
    expect(result.items[0]?.rule_id).toBeTruthy()
  })

  it('filters by wcag level', () => {
    const result = queryIssuesFromSummary(
      summary,
      { statuses: ['open'], wcagLevels: ['A'] },
      getDefaultSiteSettings()
    )
    expect(result.total).toBe(1)
    expect(result.items[0]?.rule_id).toBe('image-alt')
    expect(result.occurrencesCount).toBe(2)
  })
})
