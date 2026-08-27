import { describe, it, expect } from 'vitest'
import {
  dedupeInventoryRowsByUrl,
  formatInventoryFileSize,
  mergeInventoryPages,
  pickBaselineCompleteScan
} from '~/utils/inventoryPages'
import type { InventoryPageRow, Scan } from '~/types/sitenook'

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

  it('prefers a newer complete_with_errors scan over an older complete scan', () => {
    const result = pickBaselineCompleteScan([
      scan({ id: 'full', status: 'complete', completed_at: '2026-08-21T01:20:41.405Z' }),
      scan({ id: 'home', status: 'complete_with_errors', completed_at: '2026-08-21T02:02:49.468Z' })
    ])
    expect(result?.id).toBe('home')
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

describe('formatInventoryFileSize', () => {
  it('formats bytes as KB or MB', () => {
    expect(formatInventoryFileSize(512)).toBe('0.5 KB')
    expect(formatInventoryFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
    expect(formatInventoryFileSize(0)).toBe('—')
  })
})

describe('dedupeInventoryRowsByUrl', () => {
  it('keeps one row per URL and prefers larger size', () => {
    const rows = dedupeInventoryRowsByUrl([
      { url: 'https://example.com/a/', size_bytes: 100 },
      { url: 'https://example.com/a', size_bytes: 500 },
      { url: 'https://example.com/b', size_bytes: 50 }
    ])
    expect(rows).toHaveLength(2)
    expect(rows.find(row => row.url.includes('/a'))?.size_bytes).toBe(500)
  })

  it('merges query-string variants of the same URL', () => {
    const rows = dedupeInventoryRowsByUrl([
      { url: 'https://example.com/a?x=1', size_bytes: 100 },
      { url: 'https://example.com/a?y=2', size_bytes: 500 }
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.url).toBe('https://example.com/a')
    expect(rows[0]?.size_bytes).toBe(500)
  })
})
