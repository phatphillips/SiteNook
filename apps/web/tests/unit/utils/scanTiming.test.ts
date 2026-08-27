import { describe, it, expect } from 'vitest'
import {
  buildScanTimingPhases,
  formatDurationLong,
  formatScanDateTime,
  scanTimingPhaseRows
} from '~/utils/scanTiming'
import type { Scan } from '~/types/sitenook'

describe('formatDurationLong', () => {
  it('formats hours, minutes, and seconds', () => {
    expect(formatDurationLong(11 * 3600_000 + 25 * 60_000 + 27_000)).toBe(
      '11 hours 25 minutes 27 seconds'
    )
  })

  it('formats sub-minute durations', () => {
    expect(formatDurationLong(25_000)).toBe('25 seconds')
  })
})

describe('buildScanTimingPhases', () => {
  it('builds queue, crawl, processing, and total phases', () => {
    const scan = {
      id: 'scan1',
      site: 'site1',
      status: 'complete',
      scan_type: 'full',
      pages_crawled: 10,
      queued_at: '2026-06-28T13:09:35.000Z',
      started_at: '2026-06-28T13:10:00.000Z',
      crawl_finished_at: '2026-06-29T00:35:27.000Z',
      completed_at: '2026-06-29T02:49:49.000Z'
    } as Scan

    const phases = buildScanTimingPhases(scan)
    expect(phases.queue?.duration).toBe('25 seconds')
    expect(phases.crawl?.label).toBe('Crawl time')
    expect(phases.processing?.label).toBe('Processing time')
    expect(phases.total?.label).toBe('Total scan time')
  })

  it('omits phases when timestamps are missing', () => {
    const scan = {
      id: 'scan1',
      site: 'site1',
      status: 'complete',
      scan_type: 'full',
      pages_crawled: 1,
      started_at: '2026-06-28T13:10:00.000Z',
      completed_at: '2026-06-28T14:10:00.000Z'
    } as Scan

    const rows = scanTimingPhaseRows(scan)
    expect(rows.some(r => r.label === 'Queue time')).toBe(false)
    expect(rows.some(r => r.label === 'Total scan time')).toBe(true)
  })
})

describe('formatScanDateTime', () => {
  it('formats timestamps in dd/MM/yyyy h:mm am/pm', () => {
    const formatted = formatScanDateTime('2026-06-28T23:10:00.000Z')
    expect(formatted).toMatch(/\d{2}\/\d{2}\/2026/)
    expect(formatted).toMatch(/pm|am/)
  })
})
