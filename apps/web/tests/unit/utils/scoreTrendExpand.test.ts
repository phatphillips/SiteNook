import { describe, expect, it } from 'vitest'
import type { Scan } from '~/types/sitenook'
import {
  SCORE_TREND_SERIES,
  buildBrokenLinksTrend,
  buildOpenIssuesTrend,
  buildQaScoreTrend,
  buildSeoIssuesTrend,
  buildSeoScoreTrend,
  buildScoreTrendCsv,
  buildScoreTrendSeriesMap,
  brokenLinksLabelForMode,
  defaultVisibleSeriesIds,
  formatScoreTrendDelta,
  leadingPlaceholderInfo,
  pointDeltaVsPrevious,
  qaScoreLabelForMode,
  resolveIssuesYMax,
  scoreTrendSummaryStats,
  seoIssuesLabelForMode,
  seoScoreLabelForMode
} from '~/utils/scoreTrendExpand'
import {
  scoreTrendExpandBounds,
  scoreTrendExpandPresetLabel
} from '~/utils/scoreTrendExpandRange'

function scan(partial: Partial<Scan> & Pick<Scan, 'id'>): Scan {
  return {
    site: 'site1',
    status: 'complete',
    scan_type: 'full',
    pages_crawled: 1,
    ...partial
  }
}

describe('scoreTrendExpandRange', () => {
  it('builds 7-day and 365-day inclusive bounds', () => {
    const seven = scoreTrendExpandBounds({ preset: 7 })
    expect(seven.dayCount).toBe(7)

    const year = scoreTrendExpandBounds({ preset: 365 })
    expect(year.dayCount).toBe(365)
  })

  it('builds custom inclusive day count', () => {
    const start = new Date(2024, 0, 1)
    const end = new Date(2024, 0, 10)
    const bounds = scoreTrendExpandBounds({
      preset: 'custom',
      customStart: start,
      customEnd: end
    })
    expect(bounds.dayCount).toBe(10)
  })

  it('labels presets', () => {
    expect(scoreTrendExpandPresetLabel(7)).toBe('7d')
    expect(scoreTrendExpandPresetLabel(365)).toBe('12mo')
    expect(scoreTrendExpandPresetLabel('custom')).toBe('Custom')
  })
})

describe('scoreTrendExpand', () => {
  it('defaults to Overall visible only', () => {
    expect([...defaultVisibleSeriesIds()]).toEqual(['overall'])
  })

  it('builds multi-series maps for site mode', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const bounds = scoreTrendExpandBounds({
      preset: 'custom',
      customStart: yesterday,
      customEnd: today
    })

    const map = buildScoreTrendSeriesMap(
      [
        scan({
          id: 's1',
          completed_at: yesterday.toISOString(),
          score_overall: 70,
          score_a: 72,
          score_aa: 68,
          score_aaa: 60,
          score_best_practices: 65
        }),
        scan({
          id: 's2',
          completed_at: today.toISOString(),
          score_overall: 80,
          score_a: 82,
          score_aa: 78,
          score_aaa: 70,
          score_best_practices: 75
        })
      ],
      bounds,
      'site'
    )

    expect(map.overall).toHaveLength(2)
    expect(map.overall[0]?.value).toBe(70)
    expect(map.overall[1]?.value).toBe(80)
    expect(map.a[1]?.value).toBe(82)
    expect(map.aa[1]?.value).toBe(78)
    expect(map.aaa[1]?.value).toBe(70)
    expect(map.bestPractices[1]?.value).toBe(75)
  })

  it('averages org multi-series across sites', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const bounds = scoreTrendExpandBounds({
      preset: 'custom',
      customStart: yesterday,
      customEnd: today
    })

    const map = buildScoreTrendSeriesMap(
      [
        scan({
          id: 'a1',
          site: 'site-a',
          completed_at: yesterday.toISOString(),
          score_overall: 80,
          score_a: 90
        }),
        scan({
          id: 'b1',
          site: 'site-b',
          completed_at: yesterday.toISOString(),
          score_overall: 60,
          score_a: 70
        })
      ],
      bounds,
      'org'
    )

    expect(map.overall[0]?.value).toBe(70)
    expect(map.a[0]?.value).toBe(80)
  })

  it('computes summary stats for overall series', () => {
    const stats = scoreTrendSummaryStats([
      { label: 'Jun 1', value: 60 },
      { label: 'Jun 2', value: null },
      { label: 'Jun 3', value: 80 },
      { label: 'Jun 4', value: 70 }
    ])
    expect(stats.current).toBe(70)
    expect(stats.change).toBe(10)
    expect(stats.min).toBe(60)
    expect(stats.max).toBe(80)
  })

  it('returns empty summary when no values', () => {
    expect(scoreTrendSummaryStats([{ label: 'Jun 1', value: null }])).toEqual({
      current: null,
      change: null,
      min: null,
      max: null
    })
  })

  it('computes point delta vs previous non-null', () => {
    const points = [
      { label: 'a', value: 50 },
      { label: 'b', value: null },
      { label: 'c', value: 65 }
    ]
    expect(pointDeltaVsPrevious(points, 0)).toBeNull()
    expect(pointDeltaVsPrevious(points, 2)).toBe(15)
    expect(pointDeltaVsPrevious(points, 1)).toBeNull()
  })

  it('formats deltas with signs', () => {
    expect(formatScoreTrendDelta(null)).toBe('—')
    expect(formatScoreTrendDelta(0)).toBe('0')
    expect(formatScoreTrendDelta(2.5)).toBe('+2.5')
    expect(formatScoreTrendDelta(-3)).toBe('−3')
  })

  it('serializes visible series to CSV', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const bounds = scoreTrendExpandBounds({
      preset: 'custom',
      customStart: yesterday,
      customEnd: today
    })

    const map = buildScoreTrendSeriesMap(
      [
        scan({
          id: 's1',
          completed_at: yesterday.toISOString(),
          score_overall: 70,
          score_a: 72
        }),
        scan({
          id: 's2',
          completed_at: today.toISOString(),
          score_overall: 80,
          score_a: 82
        })
      ],
      bounds,
      'site'
    )

    const csv = buildScoreTrendCsv(map, new Set(['overall', 'a']), 'site')
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Date,Overall,WCAG A')
    expect(lines).toHaveLength(3)
    expect(lines[2]).toContain('80')
    expect(lines[2]).toContain('82')
  })

  it('defines five series with Overall default visible', () => {
    expect(SCORE_TREND_SERIES).toHaveLength(5)
    expect(SCORE_TREND_SERIES[0]?.id).toBe('overall')
    expect(SCORE_TREND_SERIES[0]?.defaultVisible).toBe(true)
  })

  it('detects leading placeholder gap before first value', () => {
    expect(leadingPlaceholderInfo([
      { label: 'a', value: null },
      { label: 'b', value: null },
      { label: 'c', value: 80 }
    ])).toEqual({ firstIndex: 2, firstValue: 80 })
    expect(leadingPlaceholderInfo([
      { label: 'a', value: 70 },
      { label: 'b', value: 80 }
    ])).toBeNull()
  })

  it('builds open issues trend for site and org', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const bounds = scoreTrendExpandBounds({
      preset: 'custom',
      customStart: yesterday,
      customEnd: today
    })

    const sitePoints = buildOpenIssuesTrend(
      [
        scan({
          id: 's1',
          completed_at: yesterday.toISOString(),
          open_issue_count: 10
        }),
        scan({
          id: 's2',
          completed_at: today.toISOString(),
          open_issue_count: 4
        })
      ],
      bounds,
      'site'
    )
    expect(sitePoints[0]?.value).toBe(10)
    expect(sitePoints[1]?.value).toBe(4)

    const orgPoints = buildOpenIssuesTrend(
      [
        scan({
          id: 'a1',
          site: 'site-a',
          completed_at: yesterday.toISOString(),
          open_issue_count: 10
        }),
        scan({
          id: 'b1',
          site: 'site-b',
          completed_at: yesterday.toISOString(),
          open_issue_count: 5
        })
      ],
      bounds,
      'org'
    )
    expect(orgPoints[0]?.value).toBe(15)
  })

  it('resolves issues y-max with padding', () => {
    expect(resolveIssuesYMax([
      { label: 'a', value: 8 },
      { label: 'b', value: 12 }
    ])).toBe(20)
  })

  it('includes open issues column in CSV when provided', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const bounds = scoreTrendExpandBounds({
      preset: 'custom',
      customStart: yesterday,
      customEnd: today
    })
    const scans = [
      scan({
        id: 's1',
        completed_at: yesterday.toISOString(),
        score_overall: 70,
        open_issue_count: 10
      }),
      scan({
        id: 's2',
        completed_at: today.toISOString(),
        score_overall: 80,
        open_issue_count: 4
      })
    ]
    const map = buildScoreTrendSeriesMap(scans, bounds, 'site')
    const issues = buildOpenIssuesTrend(scans, bounds, 'site')
    const csv = buildScoreTrendCsv(map, new Set(['overall']), 'site', issues)
    expect(csv.split('\n')[0]).toBe('Date,Overall,Open issues')
    expect(csv).toContain('4')
  })

  it('builds broken-links and QA score trends', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const bounds = scoreTrendExpandBounds({
      preset: 'custom',
      customStart: yesterday,
      customEnd: today
    })
    const scans = [
      scan({
        id: 's1',
        completed_at: yesterday.toISOString(),
        score_qa: 70,
        broken_link_count: 12
      }),
      scan({
        id: 's2',
        completed_at: today.toISOString(),
        score_qa: 80,
        broken_link_count: 5
      })
    ]

    const links = buildBrokenLinksTrend(scans, bounds, 'site')
    expect(links[0]?.value).toBe(12)
    expect(links[1]?.value).toBe(5)

    const scores = buildQaScoreTrend(scans, bounds, 'site')
    expect(scores[0]?.value).toBe(70)
    expect(scores[1]?.value).toBe(80)

    expect(brokenLinksLabelForMode('org')).toContain('all sites')
    expect(qaScoreLabelForMode('site')).toBe('QA score')
  })

  it('builds SEO score and open-issue trends for site mode', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const bounds = scoreTrendExpandBounds({
      preset: 'custom',
      customStart: yesterday,
      customEnd: today
    })
    const scans = [
      scan({
        id: 's1',
        completed_at: yesterday.toISOString(),
        score_seo: 64,
        open_seo_count: 18
      }),
      scan({
        id: 's2',
        completed_at: today.toISOString(),
        score_seo: 72,
        open_seo_count: 9
      })
    ]

    const scores = buildSeoScoreTrend(scans, bounds, 'site')
    expect(scores[0]?.value).toBe(64)
    expect(scores[1]?.value).toBe(72)

    const issues = buildSeoIssuesTrend(scans, bounds, 'site')
    expect(issues[0]?.value).toBe(18)
    expect(issues[1]?.value).toBe(9)

    expect(seoScoreLabelForMode('org')).toBe('Avg SEO score')
    expect(seoIssuesLabelForMode('site')).toBe('Open SEO issues')
  })
})
