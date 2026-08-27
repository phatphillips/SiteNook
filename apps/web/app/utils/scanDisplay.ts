import type { Scan } from '~/types/sitenook'
import { pbOr, pbRelation, pbSelect } from '~/utils/pbFilter'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'

export const TERMINAL_SCAN_STATUSES = ['complete', 'complete_with_errors', 'failed', 'cancelled'] as const
export const ACTIVE_SCAN_STATUSES = ['running', 'background_scan'] as const

/** PocketBase list sort for scans — `created` is not sortable on this collection (returns 400). */
export const SCAN_LIST_SORT = '-completed_at,-started_at' as const

/** Statuses the user can stop from the active scans UI. */
export const STOPPABLE_ACTIVE_SCAN_STATUSES = [
  'pending',
  'processing',
  'running',
  'background_scan'
] as const

export function canStopActiveScanRow(status: string): boolean {
  return (STOPPABLE_ACTIVE_SCAN_STATUSES as readonly string[]).includes(status)
}
export const DISPLAY_SCAN_STATUSES = ['running', 'complete'] as const

export type ScanStatusUiColor = 'success' | 'error' | 'warning' | 'info' | 'neutral'

/** Nuxt UI color for scan / queue status (badges, alerts). */
export function scanStatusUiColor(status: string): ScanStatusUiColor {
  if (status === 'complete') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'cancelled' || status === 'stopping') return 'warning'
  if (status === 'complete_with_errors') return 'warning'
  if (status === 'background_scan') return 'info'
  if (status === 'running' || status === 'processing') return 'info'
  if (status === 'pending' || status === 'queued') return 'warning'
  return 'neutral'
}

/** Lucide icon class for scan / queue status in alerts. */
export function scanStatusUiIcon(status: string): string {
  if (status === 'complete') return 'i-lucide-circle-check'
  if (status === 'failed') return 'i-lucide-circle-x'
  if (status === 'cancelled') return 'i-lucide-square'
  if (status === 'stopping') return 'i-lucide-loader-circle'
  if (status === 'background_scan') return 'i-lucide-loader-circle'
  if (status === 'running' || status === 'processing') return 'i-lucide-loader-circle'
  if (status === 'complete_with_errors') return 'i-lucide-triangle-alert'
  if (status === 'pending' || status === 'queued') return 'i-lucide-clock'
  return 'i-lucide-info'
}

/** Human-readable label for active scan rows and live log summary. */
export function scanActiveStatusLabel(status: string): string {
  if (status === 'stopping') return 'Stopping?'
  if (status === 'background_scan') return 'Background scan'
  if (status === 'running') return 'Running'
  if (status === 'processing') return 'Starting'
  if (status === 'pending' || status === 'queued') return 'Queued'
  if (status === 'complete') return 'Complete'
  if (status === 'complete_with_errors') return 'Completed with errors'
  if (status === 'failed') return 'Failed'
  if (status === 'cancelled') return 'Stopped'
  return status || '—'
}

export function formatElapsedSince(iso?: string, nowMs: number = Date.now()): string {
  if (!iso) return '—'
  const start = Date.parse(iso)
  if (!Number.isFinite(start)) return '—'
  const sec = Math.max(0, Math.floor((nowMs - start) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function scanTimestamp(scan: Scan): string {
  return String(scan.completed_at ?? scan.started_at ?? scan.created ?? '')
}

export function isScanTerminal(scan: Pick<Scan, 'status'>): boolean {
  return TERMINAL_SCAN_STATUSES.includes(scan.status as typeof TERMINAL_SCAN_STATUSES[number])
}

export function isScanRunning(scan: Pick<Scan, 'status'>): boolean {
  return scan.status === 'running'
}

/** Scans that have (or may have) page/issue data worth showing in the UI. */
export function buildDisplayScansFilter(siteId: string): string {
  return `${pbRelation('site', siteId)} && ${pbOr([
    pbSelect('status', 'complete'),
    pbSelect('status', 'complete_with_errors'),
    pbSelect('status', 'running')
  ])}`
}

export function sortScansForDisplay(scans: Scan[]): Scan[] {
  return scans.slice().sort((a, b) => {
    const aRunning = isScanRunning(a) ? 1 : 0
    const bRunning = isScanRunning(b) ? 1 : 0
    if (aRunning !== bRunning) return bRunning - aRunning
    return compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b))
  })
}

export function pickDisplayScan(scans: Scan[], preferredId?: string): Scan | null {
  const sorted = sortScansForDisplay(scans)
  if (!sorted.length) return null
  if (preferredId) {
    const match = sorted.find(s => s.id === preferredId)
    if (match) return match
  }
  return sorted[0]!
}

/** Latest scan regardless of status; running wins over terminal recency. */
export function pickLatestScan(scans: Scan[]): Scan | null {
  if (!scans.length) return null
  const sorted = sortScansForDisplay(scans)
  return sorted[0] ?? null
}

export function isTrustedScan(scan: Pick<Scan, 'scan_quality'>): boolean {
  return scan.scan_quality?.trusted !== false
}

/** Latest complete scan that is allowed to drive site scores. */
export function pickLatestTrustedScan(scans: Scan[]): Scan | null {
  const candidates = scans.filter(s =>
    (s.status === 'complete' || s.status === 'complete_with_errors') && isTrustedScan(s)
  )
  if (candidates.length) {
    return candidates.slice().sort((a, b) =>
      compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b))
    )[0] ?? null
  }
  return pickLatestScan(
    scans.filter(s => s.status === 'complete' || s.status === 'complete_with_errors')
  )
}

/** Latest completed scan for scores / baseline data (ignores failed/cancelled orphans). */
export function pickLatestCompleteScan(scans: Scan[]): Scan | null {
  const complete = scans.filter(s => s.status === 'complete')
  if (!complete.length) return null
  return complete.slice().sort((a, b) =>
    compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b))
  )[0] ?? null
}

export function buildLatestCompleteScanMap(scans: Scan[]): Map<string, Scan> {
  const map = new Map<string, Scan>()
  for (const scan of scans) {
    if (scan.status !== 'complete') continue
    const existing = map.get(scan.site)
    if (!existing || compareTimestampsDesc(scanTimestamp(scan), scanTimestamp(existing)) < 0) {
      map.set(scan.site, scan)
    }
  }
  return map
}
