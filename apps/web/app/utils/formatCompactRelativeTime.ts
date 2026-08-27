const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

function parseTimestamp(value: string | Date): number | null {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

/** Compact relative time for tight toolbars: `3h ago`, `2d ago`, `just now`. */
export function formatCompactRelativeTime(
  value: string | Date,
  now: number = Date.now()
): string {
  const then = parseTimestamp(value)
  if (then == null) return ''
  const diff = Math.max(0, now - then)
  if (diff < 45_000) return 'just now'
  if (diff < HOUR_MS) return `${Math.round(diff / MINUTE_MS)}m ago`
  if (diff < DAY_MS) return `${Math.round(diff / HOUR_MS)}h ago`
  if (diff < WEEK_MS) return `${Math.round(diff / DAY_MS)}d ago`
  if (diff < MONTH_MS) return `${Math.round(diff / WEEK_MS)}w ago`
  if (diff < YEAR_MS) return `${Math.round(diff / MONTH_MS)}mo ago`
  return `${Math.round(diff / YEAR_MS)}y ago`
}

export function formatScanTimestampLabel(value: string | Date): string {
  const then = parseTimestamp(value)
  if (then == null) return typeof value === 'string' ? value : ''
  return new Date(then).toLocaleString()
}

export function compactPageUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/\/+$/, '') || '/'
    return path === '/' ? parsed.hostname : `${parsed.hostname}${path}`
  } catch {
    return url
  }
}
