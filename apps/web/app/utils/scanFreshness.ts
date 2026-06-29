export type ScanFreshness = 'fresh' | 'stale' | 'old'

/** Badge colour for last-scanned timestamp near Scan Now. */
export function scanFreshness(completedAt?: string): ScanFreshness | null {
  if (!completedAt) return null
  const hours = (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60)
  if (hours <= 2) return 'fresh'
  if (hours <= 12) return 'stale'
  return 'old'
}

export function scanFreshnessBadgeColor(freshness: ScanFreshness | null): 'success' | 'warning' | 'error' | 'neutral' {
  if (freshness === 'fresh') return 'success'
  if (freshness === 'stale') return 'warning'
  if (freshness === 'old') return 'error'
  return 'neutral'
}
