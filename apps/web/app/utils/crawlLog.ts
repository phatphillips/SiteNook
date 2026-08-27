import type { ActiveScanRow, PageRecord, Scan, ScanLogEvent } from '~/types/sitenook'

export type CrawlLogLevel = ScanLogEvent['level']

/** Max lines shown in the live log panel while a scan is still running. */
export const LIVE_LOG_DISPLAY_MAX = 50

export const TERMINAL_SCAN_LOG_STATUSES = [
  'complete',
  'complete_with_errors',
  'failed',
  'cancelled'
] as const

export function isTerminalScanLogStatus(status: string): boolean {
  return (TERMINAL_SCAN_LOG_STATUSES as readonly string[]).includes(status)
}

export function trimLogLinesToRecent(
  lines: CrawlLogLine[],
  max = LIVE_LOG_DISPLAY_MAX
): CrawlLogLine[] {
  if (lines.length <= max) return lines
  return lines.slice(lines.length - max)
}

export function formatCrawlLogLinesAsText(lines: CrawlLogLine[]): string {
  return lines
    .map((line) => {
      const ts = formatLogTimestamp(line.ts)
      const urlPart = line.url ? `\t${line.url}` : ''
      const msg =
        line.message && line.url && !line.message.includes(line.url)
          ? `\t${line.message}`
          : line.message && !line.url
            ? `\t${line.message}`
            : ''
      return `${ts}\t${line.level.toUpperCase()}${urlPart}${msg}`
    })
    .join('\n')
}

export interface CrawlLogLine {
  id: string
  ts: number
  level: CrawlLogLevel
  message: string
  url?: string
}

/** Compact error summary for scanner info (e.g. "9 × HTTP 503"). */
export function summarizeCrawlLogErrors(lines: CrawlLogLine[]): string | null {
  const counts = new Map<string, number>()
  for (const line of lines) {
    if (line.level !== 'error') continue
    const match = line.message.match(/HTTP\s+(\d{3})\b/i)
    if (!match) continue
    const key = `HTTP ${match[1]}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (!counts.size) return null
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `${count} × ${code}`)
    .join(', ')
}

const LEVEL_ORDER: Record<CrawlLogLevel, number> = {
  info: 0,
  success: 1,
  warn: 2,
  error: 3
}

export function crawlLogLevelClass(level: CrawlLogLevel): string {
  switch (level) {
    case 'success':
      return 'crawl-log-level--success'
    case 'warn':
      return 'crawl-log-level--warn'
    case 'error':
      return 'crawl-log-level--error'
    default:
      return 'crawl-log-level--info'
  }
}

export function crawlLogLevelBadgeClass(level: CrawlLogLevel): string {
  switch (level) {
    case 'success':
      return 'crawl-log-badge--success'
    case 'warn':
      return 'crawl-log-badge--warn'
    case 'error':
      return 'crawl-log-badge--error'
    default:
      return 'crawl-log-badge--info'
  }
}

export function formatLogLevelLabel(level: CrawlLogLevel): string {
  return level.toUpperCase()
}

export function eventToLine(event: ScanLogEvent): CrawlLogLine {
  const raw = event.created ?? ''
  const ms = Date.parse(String(raw))
  return {
    id: event.id,
    ts: Number.isFinite(ms) ? ms : Date.now(),
    level: event.level,
    message: event.message,
    url: event.url || undefined
  }
}

export function pageToLine(page: PageRecord): CrawlLogLine {
  const raw = page.created ?? ''
  const ms = Date.parse(String(raw))
  return {
    id: `page-${page.id}`,
    ts: Number.isFinite(ms) ? ms : Date.now(),
    level: 'success',
    message: page.title?.trim()
      ? `Crawled ${page.title.trim()} — ${page.url}`
      : `Crawled ${page.url}`,
    url: page.url
  }
}

export function scanStatusToLine(scan: Scan, previous?: Scan): CrawlLogLine | null {
  const ts = Date.parse(String(scan.completed_at ?? scan.started_at ?? scan.created ?? ''))
  const time = Number.isFinite(ts) ? ts : Date.now()

  if (scan.status === 'running' && (scan.pages_crawled ?? 0) > 0) {
    const prevPages = previous?.pages_crawled ?? 0
    if (scan.pages_crawled === prevPages) return null
    return {
      id: `scan-progress-${scan.pages_crawled}-${time}`,
      ts: time,
      level: 'info',
      message: `Progress: ${scan.pages_crawled} page(s) saved so far`
    }
  }

  if (
    scan.status === 'background_scan'
    && previous?.status !== 'background_scan'
  ) {
    const n = scan.unscanned_urls?.length ?? 0
    return {
      id: `scan-background-${time}`,
      ts: time,
      level: 'warn',
      message: `Background scan started — retrying ${n} blocked URL(s) (20s apart, up to 3 rounds)`
    }
  }

  if (previous?.status === scan.status) return null

  if (scan.status === 'complete' || scan.status === 'complete_with_errors') {
    const blocked = scan.unscanned_urls?.length ?? 0
    const suffix =
      scan.status === 'complete_with_errors' && blocked > 0
        ? ` · ${blocked} page(s) could not be scanned`
        : ''
    return {
      id: `scan-complete-${time}`,
      ts: time,
      level: scan.status === 'complete_with_errors' ? 'warn' : 'success',
      message: `Scan complete — ${scan.pages_crawled ?? 0} page(s) saved${suffix}`
    }
  }

  if (scan.status === 'cancelled') {
    return {
      id: `scan-cancelled-${time}`,
      ts: time,
      level: 'warn',
      message: 'Scan cancelled'
    }
  }

  if (scan.status === 'failed' && scan.error_message) {
    return {
      id: `scan-failed-${time}`,
      ts: time,
      level: 'error',
      message: scan.error_message
    }
  }

  return null
}

export function mergeCrawlLogLines(
  events: CrawlLogLine[],
  pages: CrawlLogLine[],
  preferEvents: boolean
): CrawlLogLine[] {
  const byKey = new Map<string, CrawlLogLine>()
  const successUrls = new Set<string>()

  function addLine(line: CrawlLogLine, key = line.id) {
    if (line.level === 'success' && line.url) {
      if (successUrls.has(line.url)) return
      successUrls.add(line.url)
    }
    if (!byKey.has(key)) byKey.set(key, line)
  }

  for (const line of events) {
    addLine(line)
  }

  if (!preferEvents || events.length === 0) {
    for (const line of pages) {
      const key = line.url ? `page-url:${line.url}` : line.id
      addLine(line, key)
    }
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts
    return LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
  })
}

export function queueStatusMessage(row: ActiveScanRow): string {
  if (row.status === 'processing') return 'Worker picked up scan…'
  return 'Waiting in queue…'
}

export function formatLogTimestamp(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return ''
  }
}
