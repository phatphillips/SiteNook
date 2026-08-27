import { describe, it, expect } from 'vitest'
import { buildLatestScanMap } from '~/composables/useScans'
import type { Scan } from '~/types/sitenook'

function scan(partial: Partial<Scan> & { id: string, site: string }): Scan {
  return {
    status: 'complete',
    scan_type: 'full',
    pages_crawled: 0,
    ...partial
  }
}

describe('buildLatestScanMap', () => {
  it('keeps the most recent scan per site', () => {
    const map = buildLatestScanMap([
      scan({ id: '1', site: 'a', completed_at: '2026-01-01T00:00:00.000Z' }),
      scan({ id: '2', site: 'a', completed_at: '2026-06-01T00:00:00.000Z' }),
      scan({ id: '3', site: 'b', completed_at: '2026-03-01T00:00:00.000Z' })
    ])
    expect(map.get('a')?.id).toBe('2')
    expect(map.get('b')?.id).toBe('3')
  })

  it('returns empty map for no scans', () => {
    expect(buildLatestScanMap([]).size).toBe(0)
  })
})
