import type { InventoryPageBadge, InventoryPageRow, Scan } from '~/types/accessiq'
import { normalizePageUrl } from '~/utils/pageUrl'
import { scanTimestamp } from '~/utils/scanDisplay'

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
  const complete = scans.filter(s => s.status === 'complete')
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
