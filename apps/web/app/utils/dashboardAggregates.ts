import type { Site, Scan } from '~/types/sitenook'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import { pickLatestTrustedScan, scanTimestamp } from '~/utils/scanDisplay'

export interface SiteDashboardSnapshot {
  siteId: string
  siteName: string
  siteUrl: string
  accessibilityScore: number | null
  qaScore: number | null
  seoScore: number | null
  openA11yIssues: number
  openQaIssues: number
  openSeoIssues: number
  brokenLinkCount: number
  misspellingCount: number
  technicalSeoCount: number
  contentSeoCount: number
  lastScanAt: string | null
}

export interface OrgDashboardAggregates {
  avgAccessibilityScore: number | null
  avgQaScore: number | null
  avgSeoScore: number | null
  totalOpenA11yIssues: number
  totalOpenQaIssues: number
  totalOpenSeoIssues: number
  totalBrokenLinks: number
  totalMisspellings: number
  totalTechnicalSeoIssues: number
  totalContentSeoIssues: number
  siteSnapshots: SiteDashboardSnapshot[]
}

export type DashboardScoreField = 'accessibilityScore' | 'qaScore' | 'seoScore'
export type DashboardIssueField = 'openA11yIssues' | 'openQaIssues' | 'openSeoIssues'

export function averageScore(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!valid.length) return null
  const sum = valid.reduce((total, value) => total + value, 0)
  return Math.round((sum / valid.length) * 10) / 10
}

export function sumCounts(values: number[]): number {
  return values.reduce((total, value) => total + Math.max(0, value), 0)
}

export function buildSiteDashboardSnapshot(input: {
  site: Site
  latestScan: Scan | null
  openA11yIssues: number
  openQaIssues: number
  openSeoIssues: number
  brokenLinkCount?: number
  misspellingCount?: number
  technicalSeoCount?: number
  contentSeoCount?: number
}): SiteDashboardSnapshot {
  const { site, latestScan, openA11yIssues, openQaIssues, openSeoIssues } = input
  const a11yFromSummary = site.current_a11y?.open_issue_count
  const brokenLinkCount = Math.max(0, input.brokenLinkCount ?? 0)
  const misspellingCount = Math.max(0, input.misspellingCount ?? 0)
  const technicalSeoCount = Math.max(0, input.technicalSeoCount ?? 0)
  const contentSeoCount = Math.max(0, input.contentSeoCount ?? 0)

  return {
    siteId: site.id,
    siteName: site.name,
    siteUrl: site.url,
    accessibilityScore: latestScan?.score_overall ?? null,
    qaScore: latestScan?.score_qa ?? null,
    seoScore: latestScan?.score_seo ?? null,
    openA11yIssues: openA11yIssues || latestScan?.open_issue_count || a11yFromSummary || 0,
    openQaIssues: openQaIssues || brokenLinkCount + misspellingCount,
    openSeoIssues: openSeoIssues || technicalSeoCount + contentSeoCount,
    brokenLinkCount,
    misspellingCount,
    technicalSeoCount,
    contentSeoCount,
    lastScanAt: latestScan ? scanTimestamp(latestScan) || null : null
  }
}

export function aggregateOrgDashboard(
  snapshots: SiteDashboardSnapshot[]
): OrgDashboardAggregates {
  return {
    avgAccessibilityScore: averageScore(snapshots.map(snapshot => snapshot.accessibilityScore)),
    avgQaScore: averageScore(snapshots.map(snapshot => snapshot.qaScore)),
    avgSeoScore: averageScore(snapshots.map(snapshot => snapshot.seoScore)),
    totalOpenA11yIssues: sumCounts(snapshots.map(snapshot => snapshot.openA11yIssues)),
    totalOpenQaIssues: sumCounts(snapshots.map(snapshot => snapshot.openQaIssues)),
    totalOpenSeoIssues: sumCounts(snapshots.map(snapshot => snapshot.openSeoIssues)),
    totalBrokenLinks: sumCounts(snapshots.map(snapshot => snapshot.brokenLinkCount)),
    totalMisspellings: sumCounts(snapshots.map(snapshot => snapshot.misspellingCount)),
    totalTechnicalSeoIssues: sumCounts(snapshots.map(snapshot => snapshot.technicalSeoCount)),
    totalContentSeoIssues: sumCounts(snapshots.map(snapshot => snapshot.contentSeoCount)),
    siteSnapshots: [...snapshots]
  }
}

function compareNullableScores(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}

export function sortAttentionSites(
  snapshots: SiteDashboardSnapshot[],
  scoreField: DashboardScoreField,
  issueField: DashboardIssueField,
  limit = 5
): SiteDashboardSnapshot[] {
  return [...snapshots]
    .sort((left, right) => {
      const scoreDelta = compareNullableScores(left[scoreField], right[scoreField])
      if (scoreDelta !== 0) return scoreDelta
      return right[issueField] - left[issueField]
    })
    .slice(0, limit)
}

export function pickLatestScanForSite(scans: Scan[]): Scan | null {
  const terminal = scans.filter(scan =>
    scan.status === 'complete' || scan.status === 'complete_with_errors'
  )
  return pickLatestTrustedScan(terminal)
}

export function sortSnapshotsByLastScan(
  snapshots: SiteDashboardSnapshot[]
): SiteDashboardSnapshot[] {
  return [...snapshots].sort((left, right) =>
    compareTimestampsDesc(left.lastScanAt ?? '', right.lastScanAt ?? '')
  )
}
