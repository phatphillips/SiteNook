import { describe, it, expect } from 'vitest'
import { mergeInventoryPages, pickBaselineCompleteScan } from '~/utils/inventoryPages'
import type { InventoryPageRow, Scan } from '~/types/accessiq'

function page(partial: Partial<InventoryPageRow> & { id: string, url: string }): InventoryPageRow {
  return {
    ...partial
  }
}

function scan(partial: Partial<Scan> & { id: string, status: Scan['status'] }): Scan {
  return {
    site: 'site-1',
    scan_type: 'full',
    pages_crawled: 0,
    ...partial
  }
}

describe('pickBaselineCompleteScan', () => {
  it('returns most recent complete scan', () => {
    const result = pickBaselineCompleteScan([
      scan({ id: 'old', status: 'complete', completed_at: '2026-01-01T00:00:00.000Z' }),
      scan({ id: 'new', status: 'complete', completed_at: '2026-06-01T00:00:00.000Z' }),
      scan({ id: 'running', status: 'running', started_at: '2026-06-02T00:00:00.000Z' })
    ])
    expect(result?.id).toBe('new')
  })
})

describe('mergeInventoryPages', () => {
  it('returns latest row per URL when no running scan', () => {
    const merged = mergeInventoryPages([
      page({ id: '1', url: 'https://example.com/a', created: '2026-01-01T00:00:00.000Z' }),
      page({ id: '2', url: 'https://example.com/a', created: '2026-06-01T00:00:00.000Z' })
    ], null, null)

    expect(merged).toHaveLength(1)
    expect(merged[0]?.id).toBe('2')
  })

  it('merges baseline and running scans with badges', () => {
    const baseline = scan({ id: 'complete-1', status: 'complete', completed_at: '2026-05-01T00:00:00.000Z' })
    const running = scan({ id: 'running-1', status: 'running', started_at: '2026-06-01T00:00:00.000Z' })

    const merged = mergeInventoryPages([
      page({ id: 'p1', url: 'https://example.com/existing', scan: 'complete-1', created: '2026-05-01T00:00:00.000Z' }),
      page({ id: 'p2', url: 'https://example.com/pending', scan: 'complete-1', created: '2026-05-01T00:00:00.000Z' }),
      page({ id: 'p3', url: 'https://example.com/existing', scan: 'running-1', created: '2026-06-01T00:00:00.000Z' }),
      page({ id: 'p4', url: 'https://example.com/new', scan: 'running-1', created: '2026-06-01T00:00:00.000Z' })
    ], running, baseline)

    const byUrl = Object.fromEntries(merged.map(row => [row.url, row.inventoryBadge]))

    expect(byUrl['https://example.com/existing']).toBe('updated')
    expect(byUrl['https://example.com/new']).toBe('new')
    expect(byUrl['https://example.com/pending']).toBe('pending')
    expect(merged.find(row => row.inventoryBadge === 'updated')?.id).toBe('p3')
  })
})
