import { describe, expect, it } from 'vitest'
import type { Scan } from '~/types/sitenook'
import {
  buildDailyEventCountSeries,
  buildDailyTrendSeries,
  buildOrgAverageDailyTrend,
  buildOrgSumDailyTrend,
  hasTrendData,
  sumTrendValues,
  trendDelta
} from '~/utils/scanTrendSeries'

function scan(partial: Partial<Scan> & Pick<Scan, 'id'>): Scan {
  return {
    site: 'site1',
    status: 'complete',
    scan_type: 'full',
    pages_crawled: 1,
    ...partial
  }
}

describe('scanTrendSeries', () => {
  it('carries forward the latest completed scan value by day', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    const points = buildDailyTrendSeries([
      scan({
        id: 's1',
        completed_at: yesterday.toISOString(),
        score_aa: 70,
        open_issue_count: 4
      }),
      scan({
        id: 's2',
        completed_at: today.toISOString(),
        score_aa: 82,
        open_issue_count: 2
      })
    ], s => s.score_aa ?? null, 2)

    expect(points).toHaveLength(2)
    expect(points[0]?.value).toBe(70)
    expect(points[1]?.value).toBe(82)
  })

  it('computes trend delta and data presence', () => {
    const points = [
      { label: 'Jun 1', value: 10 },
      { label: 'Jun 2', value: 7 }
    ]
    expect(trendDelta(points)).toBe(-3)
    expect(hasTrendData(points)).toBe(true)
    expect(hasTrendData([{ label: 'Jun 1', value: null }])).toBe(false)
  })

  it('averages carried-forward scores across sites by day', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    const points = buildOrgAverageDailyTrend([
      scan({
        id: 'a1',
        site: 'site-a',
        completed_at: yesterday.toISOString(),
        score_overall: 80
      }),
      scan({
        id: 'b1',
        site: 'site-b',
        completed_at: yesterday.toISOString(),
        score_overall: 60
      }),
      scan({
        id: 'a2',
        site: 'site-a',
        completed_at: today.toISOString(),
        score_overall: 90
      })
    ], s => s.score_overall ?? null, 2)

    expect(points).toHaveLength(2)
    // yesterday: (80 + 60) / 2 = 70
    expect(points[0]?.value).toBe(70)
    // today: site-a 90, site-b still 60 → 75
    expect(points[1]?.value).toBe(75)
  })

  it('buckets event counts by day without carrying forward', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    const points = buildDailyEventCountSeries([
      { loggedAt: yesterday.toISOString(), count: 2 },
      { loggedAt: yesterday.toISOString(), count: 3 },
      { loggedAt: today.toISOString(), count: 1 }
    ], 2)

    expect(points).toHaveLength(2)
    expect(points[0]?.value).toBe(5)
    expect(points[1]?.value).toBe(1)
    expect(sumTrendValues(points)).toBe(6)
  })

  it('fills missing event days with zero', () => {
    const points = buildDailyEventCountSeries([], 3)
    expect(points).toHaveLength(3)
    expect(points.every(p => p.value === 0)).toBe(true)
    expect(sumTrendValues(points)).toBe(0)
  })

  it('sums carried-forward open issue counts across sites by day', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    const points = buildOrgSumDailyTrend([
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
      }),
      scan({
        id: 'a2',
        site: 'site-a',
        completed_at: today.toISOString(),
        open_issue_count: 7
      })
    ], s => s.open_issue_count ?? null, 2)

    expect(points).toHaveLength(2)
    // yesterday: 10 + 5
    expect(points[0]?.value).toBe(15)
    // today: site-a 7, site-b still 5 → 12
    expect(points[1]?.value).toBe(12)
  })
})
