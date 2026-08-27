import { format } from 'date-fns'
import type { Scan } from '~/types/sitenook'

export interface ScanTimingPhase {
  label: string
  duration: string
  started: string
  finished: string
}

export interface ScanTimingBreakdown {
  queue: ScanTimingPhase | null
  crawl: ScanTimingPhase | null
  processing: ScanTimingPhase | null
  total: ScanTimingPhase | null
}

function parseIso(iso?: string | null): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

export function formatDurationLong(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
  if (seconds > 0 || !parts.length) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`)
  return parts.join(' ')
}

export function formatScanDateTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return format(new Date(iso), 'dd/MM/yyyy h:mm a').toLowerCase()
  } catch {
    return '—'
  }
}

function buildPhase(
  label: string,
  startIso?: string | null,
  endIso?: string | null
): ScanTimingPhase | null {
  const startMs = parseIso(startIso)
  const endMs = parseIso(endIso)
  if (startMs == null || endMs == null || endMs < startMs) return null
  return {
    label,
    duration: formatDurationLong(endMs - startMs),
    started: formatScanDateTime(startIso),
    finished: formatScanDateTime(endIso)
  }
}

export function buildScanTimingPhases(scan: Scan): ScanTimingBreakdown {
  const queuedAt = scan.queued_at ?? scan.created
  const startedAt = scan.started_at ?? queuedAt
  const crawlFinishedAt = scan.crawl_finished_at
  const completedAt = scan.completed_at

  const queue = buildPhase('Queue time', queuedAt, startedAt)
  const crawl = buildPhase('Crawl time', startedAt, crawlFinishedAt)
  const processing = buildPhase('Processing time', crawlFinishedAt, completedAt)
  const total = buildPhase('Total scan time', queuedAt ?? startedAt, completedAt)

  return { queue, crawl, processing, total }
}

export function scanTimingPhaseRows(scan: Scan): ScanTimingPhase[] {
  const phases = buildScanTimingPhases(scan)
  const rows: ScanTimingPhase[] = []
  if (phases.queue) rows.push(phases.queue)
  if (phases.crawl) rows.push(phases.crawl)
  if (phases.processing) rows.push(phases.processing)
  if (phases.total) rows.push(phases.total)
  return rows
}

export function showScanDetailsSection(scan: Scan): boolean {
  return Boolean(scan.started_at || scan.completed_at || scan.queued_at)
}
