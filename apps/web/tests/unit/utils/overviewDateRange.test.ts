import { describe, expect, it } from 'vitest'
import type { Scan } from '~/types/accessiq'
import {
  filterScansByDateRange,
  overviewRangeBounds,
  scanInDateRange
} from '~/utils/overviewDateRange'

function scan(partial: Partial<Scan> & Pick<Scan, 'id'>): Scan {
  return {
    site: 'site1',
    status: 'complete',
    scan_type: 'full',
    pages_crawled: 1,
    ...partial
  }
}

describe('overviewDateRange', () => {
  it('builds 30-day bounds by default', () => {
    const bounds = overviewRangeBounds({ preset: 30 })
    expect(bounds.dayCount).toBe(30)
    expect(bounds.end.getTime()).toBeGreaterThanOrEqual(bounds.start.getTime())
  })

  it('filters scans inside custom bounds', () => {
    const start = new Date('2026-01-01T12:00:00Z')
    const end = new Date('2026-01-31T12:00:00Z')
    const bounds = overviewRangeBounds({
      preset: 'custom',
      customStart: start,
      customEnd: end
    })

    const inside = scan({
      id: 'in',
      completed_at: '2026-01-15T10:00:00Z'
    })
    const outside = scan({
      id: 'out',
      completed_at: '2025-12-01T10:00:00Z'
    })

    expect(scanInDateRange(inside, bounds)).toBe(true)
    expect(scanInDateRange(outside, bounds)).toBe(false)
    expect(filterScansByDateRange([inside, outside], bounds)).toEqual([inside])
  })
})
