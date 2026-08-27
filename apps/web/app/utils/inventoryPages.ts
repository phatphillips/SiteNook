import type { InventoryPageBadge, InventoryPageRow, Scan } from '~/types/sitenook'
import { inventoryUrlDedupeKey, normalizeInventoryUrl } from '~/utils/inventoryUrl'
import { normalizePageUrl } from '~/utils/pageUrl'
import { scanTimestamp } from '~/utils/scanDisplay'

/** File size for inventory rows (HTML page bytes or asset bytes). */
export function inventoryRowSizeBytes(row: Record<string, unknown>): number {
  if (typeof row.size_bytes === 'number' && row.size_bytes > 0) return row.size_bytes
  if (typeof row.html_size_bytes === 'number' && row.html_size_bytes > 0) return row.html_size_bytes
  return 0
}

/** Display inventory size in KB or MB. */
export function formatInventoryFileSize(bytes: unknown): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function dedupeInventoryRowsByUrl<T extends { url: string }>(items: T[]): T[] {
  const byUrl = new Map<string, T>()
  for (const item of items) {
    const key = inventoryUrlDedupeKey(item.url)
    const existing = byUrl.get(key)
    const normalized = normalizeInventoryUrl(item.url)
    const candidate = normalized === item.url ? item : { ...item, url: normalized }
    if (
      !existing
      || inventoryRowSizeBytes(candidate as Record<string, unknown>)
        > inventoryRowSizeBytes(existing as Record<string, unknown>)
    ) {
      byUrl.set(key, candidate)
    }
  }
  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url))
}

export function pageScannedTimestamp(page: InventoryPageRow): string {
  if (page.created) return page.created
  const scan = page.expand?.scan
  if (scan) return scanTimestamp(scan)
  return ''
}

export function pageScannedMs(page: InventoryPageRow): number {
  const raw = pageScannedTimestamp(page)
  if (!raw) return 0
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : 0
}

export function pickBaselineCompleteScan(scans: Scan[]): Scan | null {
  const complete = scans.filter(s =>
    s.status === 'complete' || s.status === 'complete_with_errors'
  )
  if (!complete.length) return null
  return complete.slice().sort((a, b) => {
    const aMs = Date.parse(scanTimestamp(a)) || 0
    const bMs = Date.parse(scanTimestamp(b)) || 0
    return bMs - aMs
  })[0] ?? null
}

function pagesForScan(pages: InventoryPageRow[], scanId: string): InventoryPageRow[] {
  return pages.filter(p => p.scan === scanId || p.expand?.scan?.id === scanId)
}

function latestRowByUrl(rows: InventoryPageRow[]): Map<string, InventoryPageRow> {
  const map = new Map<string, InventoryPageRow>()
  for (const row of rows) {
    const key = normalizePageUrl(row.url)
    const existing = map.get(key)
    if (!existing || pageScannedMs(row) >= pageScannedMs(existing)) {
      map.set(key, row)
    }
  }
  return map
}

/**
 * Merge baseline (last complete scan) with live running scan pages.
 * Running rows win on URL collision; baseline-only URLs stay visible as pending.
 */
export function mergeInventoryPages(
  allPages: InventoryPageRow[],
  runningScan: Scan | null,
  baselineScan: Scan | null
): InventoryPageRow[] {
  if (!runningScan) {
    const byUrl = latestRowByUrl(allPages)
    return [...byUrl.values()]
      .map(row => ({ ...row, inventoryBadge: null as InventoryPageBadge }))
      .sort((a, b) => pageScannedMs(b) - pageScannedMs(a))
  }

  const baselineRows = baselineScan
    ? pagesForScan(allPages, baselineScan.id)
    : []
  const runningRows = pagesForScan(allPages, runningScan.id)

  const baselineByUrl = latestRowByUrl(baselineRows)
  const runningByUrl = latestRowByUrl(runningRows)
  const merged = new Map<string, InventoryPageRow>()

  for (const [key, row] of runningByUrl) {
    const badge: InventoryPageBadge = baselineByUrl.has(key) ? 'updated' : 'new'
    merged.set(key, { ...row, inventoryBadge: badge })
  }

  for (const [key, row] of baselineByUrl) {
    if (!merged.has(key)) {
      merged.set(key, { ...row, inventoryBadge: 'pending' })
    }
  }

  return [...merged.values()].sort((a, b) => {
    const aPending = a.inventoryBadge === 'pending' ? 1 : 0
    const bPending = b.inventoryBadge === 'pending' ? 1 : 0
    if (aPending !== bPending) return aPending - bPending
    return pageScannedMs(b) - pageScannedMs(a)
  })
}

export function inventoryBadgeLabel(badge: InventoryPageBadge): string {
  if (badge === 'new') return 'New'
  if (badge === 'updated') return 'Updated'
  if (badge === 'pending') return 'Pending'
  return ''
}

export function inventoryBadgeColor(
  badge: InventoryPageBadge
): 'success' | 'info' | 'warning' | 'neutral' {
  if (badge === 'new') return 'success'
  if (badge === 'updated') return 'info'
  if (badge === 'pending') return 'warning'
  return 'neutral'
}
