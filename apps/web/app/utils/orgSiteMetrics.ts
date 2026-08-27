import type { SiteDashboardSnapshot } from '~/utils/dashboardAggregates'

export interface SiteMetricBarPoint {
  siteId: string
  label: string
  value: number
  href?: string
  /** Extra lines shown in the chart tooltip. */
  tooltipLines?: string[]
}

/** Cross-site series for org overview metric cards (highest values first, capped). */
export function siteMetricPoints(
  snapshots: SiteDashboardSnapshot[],
  readValue: (snapshot: SiteDashboardSnapshot) => number | null | undefined,
  limit = 12
): Array<{ label: string, value: number | null }> {
  return [...snapshots]
    .map(snapshot => ({
      label: snapshot.siteName,
      value: readValue(snapshot) ?? null
    }))
    .filter(point => point.value != null)
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))
    .slice(0, limit)
}

/** Bar-chart series for open issues by site (fewest → most). */
export function siteIssueBarPoints(
  snapshots: SiteDashboardSnapshot[],
  readValue: (snapshot: SiteDashboardSnapshot) => number | null | undefined,
  hrefForSite: (snapshot: SiteDashboardSnapshot) => string,
  limit = 12,
  options?: {
    tooltipLines?: (snapshot: SiteDashboardSnapshot, value: number) => string[]
  }
): SiteMetricBarPoint[] {
  return [...snapshots]
    .map((snapshot) => {
      const value = readValue(snapshot)
      if (value == null) return null
      const score = snapshot.accessibilityScore
      const tooltipLines = options?.tooltipLines?.(snapshot, value) ?? [
        `${value} open issue${value === 1 ? '' : 's'}`,
        score != null ? `Accessibility score ${Math.round(score)}%` : 'No accessibility score yet'
      ]
      return {
        siteId: snapshot.siteId,
        label: snapshot.siteName,
        value,
        href: hrefForSite(snapshot),
        tooltipLines
      } satisfies SiteMetricBarPoint
    })
    .filter((point): point is SiteMetricBarPoint => point != null)
    .sort((left, right) => left.value - right.value || left.label.localeCompare(right.label))
    .slice(0, limit)
}
