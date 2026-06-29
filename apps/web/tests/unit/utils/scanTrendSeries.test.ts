import { describe, expect, it } from 'vitest'
import type { Scan } from '~/types/accessiq'
import { buildDailyTrendSeries, hasTrendData, trendDelta } from '~/utils/scanTrendSeries'

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
})
