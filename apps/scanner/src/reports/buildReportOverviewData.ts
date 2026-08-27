import type PocketBase from 'pocketbase'
import type { ReportJobRecord, ReportOverviewSectionKey } from './types.js'

type RecordData = Record<string, unknown>

export interface ReportTrendPoint {
  label: string
  value: number | null
}

export interface SiteSnapshotRow {
  siteName: string
  accessibilityScore: number | null
  qaScore: number | null
  seoScore: number | null
  openA11yIssues: number
  openQaIssues: number
  openSeoIssues: number
}

export interface AccessibilityOverviewData {
  score: number | null
  levelA: number | null
  levelAA: number | null
  levelAAA: number | null
  bestPractices: number | null
  openIssues: number
  impactCounts: Record<string, number>
  trend: ReportTrendPoint[]
  issuesTrend: ReportTrendPoint[]
}

export interface QaOverviewData {
  score: number | null
  brokenLinks: number
  misspellings: number
  policies: number
  avgReadability: number | null
}

export interface SeoOverviewData {
  score: number | null
  technicalScore: number | null
  contentScore: number | null
  crawlabilityScore: number | null
  technicalIssues: number
  contentIssues: number
  seoTrend: ReportTrendPoint[]
  crawlabilityTrend: ReportTrendPoint[]
}

export interface ReportOverviewData {
  scopeLabel: string
  isAllSites: boolean
  accessibility?: AccessibilityOverviewData
  qa?: QaOverviewData
  seo?: SeoOverviewData
  orgSummary?: {
    sites: SiteSnapshotRow[]
    avgAccessibility: number | null
    avgQa: number | null
    avgSeo: number | null
    totalOpenA11yIssues: number
    totalOpenQaIssues: number
    totalOpenSeoIssues: number
  }
}

type ScanRecord = {
  id: string
  site: string
  status?: string
  completed_at?: string
  started_at?: string
  created?: string
  score_overall?: number
  score_a?: number
  score_aa?: number
  score_aaa?: number
  score_best_practices?: number
  score_qa?: number
  score_seo?: number
  score_seo_technical?: number
  score_seo_content?: number
  score_seo_crawlability?: number
  open_issue_count?: number
}

type SiteRecord = {
  id: string
  name?: string
  organization?: string
}

const TREND_DAYS = 30
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!valid.length) return null
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function subDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() - amount)
  return startOfDay(next)
}

function formatDayLabel(date: Date): string {
  return `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}`
}

function scanTimestamp(scan: ScanRecord): string | null {
  return scan.completed_at ?? scan.started_at ?? scan.created ?? null
}

async function countCollection(pb: PocketBase, collection: string, filter: string): Promise<number> {
  try {
    const result = await pb.collection(collection).getList(1, 1, { filter, fields: 'id' })
    return result.totalItems
  } catch {
    return 0
  }
}

async function latestScanForSite(pb: PocketBase, siteId: string): Promise<ScanRecord | null> {
  const list = await pb.collection('scans').getList(1, 1, {
    filter: `site = "${siteId}" && (status = "complete" || status = "complete_with_errors")`,
    sort: '-completed_at,-started_at',
    fields: [
      'id',
      'site',
      'completed_at',
      'started_at',
      'created',
      'score_overall',
      'score_a',
      'score_aa',
      'score_aaa',
      'score_best_practices',
      'score_qa',
      'score_seo',
      'score_seo_technical',
      'score_seo_content',
      'score_seo_crawlability',
      'open_issue_count'
    ].join(',')
  })
  return (list.items[0] as unknown as ScanRecord | undefined) ?? null
}

async function scansForSites(pb: PocketBase, siteIds: string[]): Promise<ScanRecord[]> {
  if (!siteIds.length) return []
  const siteFilter = siteIds.map(id => `site = "${id}"`).join(' || ')
  const since = subDays(new Date(), TREND_DAYS - 1).toISOString()
  const rows = await pb.collection('scans').getFullList({
    filter: `(${siteFilter}) && (status = "complete" || status = "complete_with_errors") && (completed_at >= "${since}" || started_at >= "${since}")`,
    sort: 'completed_at,started_at',
    fields: [
      'id',
      'site',
      'completed_at',
      'started_at',
      'created',
      'score_overall',
      'score_seo',
      'score_seo_crawlability',
      'open_issue_count'
    ].join(',')
  })
  return rows as unknown as ScanRecord[]
}

function buildDailyTrend(
  scans: ScanRecord[],
  readValue: (scan: ScanRecord) => number | null | undefined,
  days = TREND_DAYS
): ReportTrendPoint[] {
  const completed = scans
    .map((scan) => {
      const ts = scanTimestamp(scan)
      if (!ts) return null
      const day = startOfDay(new Date(ts)).getTime()
      return { day, scan, ts: Date.parse(ts) }
    })
    .filter((entry): entry is { day: number, scan: ScanRecord, ts: number } => entry != null)
    .sort((a, b) => a.day - b.day || a.ts - b.ts)

  const points: ReportTrendPoint[] = []
  let scanIdx = 0
  let lastValue: number | null = null

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayDate = subDays(new Date(), offset)
    const dayMs = dayDate.getTime()
    while (scanIdx < completed.length && completed[scanIdx]!.day <= dayMs) {
      const raw = readValue(completed[scanIdx]!.scan)
      lastValue = raw == null ? lastValue : raw
      scanIdx += 1
    }
    points.push({
      label: formatDayLabel(dayDate),
      value: lastValue
    })
  }

  return points
}

async function countImpactBySeverity(pb: PocketBase, scanIds: string[]): Promise<Record<string, number>> {
  if (!scanIds.length) return {}
  const filter = `(${scanIds.map(id => `scan = "${id}"`).join(' || ')}) && status = "open"`
  const rows = await pb.collection('accessibility_issues').getFullList({
    filter,
    fields: 'impact'
  }) as unknown as RecordData[]

  const counts: Record<string, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0
  }
  for (const row of rows) {
    const impact = String(row.impact ?? '').toLowerCase()
    if (impact in counts) counts[impact]! += 1
  }
  return counts
}

async function averageReadability(pb: PocketBase, scanId: string): Promise<number | null> {
  const pages = await pb.collection('pages').getFullList({
    filter: `scan = "${scanId}"`,
    fields: 'readability_score'
  }) as unknown as RecordData[]

  const scores = pages
    .map(page => toFiniteNumber(page.readability_score))
    .filter((score): score is number => score != null)
  if (!scores.length) return null
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

async function resolveSites(pb: PocketBase, job: ReportJobRecord): Promise<SiteRecord[]> {
  if (job.include_all_sites) {
    return await pb.collection('sites').getFullList({
      filter: `organization = "${job.org}"`,
      fields: 'id,name,organization',
      sort: 'name'
    }) as unknown as SiteRecord[]
  }
  if (!job.site) return []
  const site = await pb.collection('sites').getOne(job.site, { fields: 'id,name,organization' }) as SiteRecord
  return [site]
}

async function buildSiteSnapshots(pb: PocketBase, sites: SiteRecord[]): Promise<SiteSnapshotRow[]> {
  const snapshots: SiteSnapshotRow[] = []
  for (const site of sites) {
    const latest = await latestScanForSite(pb, site.id)
    let openQa = 0
    let openSeo = 0
    if (latest?.id) {
      openQa = (await countCollection(pb, 'qa_broken_links', `scan = "${latest.id}" && status != "dismissed"`))
        + (await countCollection(pb, 'qa_spelling', `scan = "${latest.id}" && status = "open"`))
      openSeo = await countCollection(pb, 'seo_issues', `scan = "${latest.id}" && status = "open"`)
    }
    snapshots.push({
      siteName: site.name?.trim() || 'Unnamed site',
      accessibilityScore: toFiniteNumber(latest?.score_overall),
      qaScore: toFiniteNumber(latest?.score_qa),
      seoScore: toFiniteNumber(latest?.score_seo),
      openA11yIssues: latest?.open_issue_count ?? 0,
      openQaIssues: openQa,
      openSeoIssues: openSeo
    })
  }
  return snapshots
}

export async function buildReportOverviewData(
  pb: PocketBase,
  job: ReportJobRecord,
  scanIds: string[],
  sections: ReportOverviewSectionKey[]
): Promise<ReportOverviewData> {
  const sites = await resolveSites(pb, job)
  const siteIds = sites.map(site => site.id)
  const latestScans = (
    await Promise.all(siteIds.map(siteId => latestScanForSite(pb, siteId)))
  ).filter((scan): scan is ScanRecord => scan != null)
  const trendScans = await scansForSites(pb, siteIds)
  const snapshots = await buildSiteSnapshots(pb, sites)

  const result: ReportOverviewData = {
    scopeLabel: job.include_all_sites ? 'All sites' : (sites[0]?.name?.trim() || 'Single site'),
    isAllSites: !!job.include_all_sites
  }

  if (sections.includes('overview.accessibility')) {
    result.accessibility = {
      score: average(latestScans.map(scan => scan.score_overall)),
      levelA: average(latestScans.map(scan => scan.score_a)),
      levelAA: average(latestScans.map(scan => scan.score_aa)),
      levelAAA: average(latestScans.map(scan => scan.score_aaa)),
      bestPractices: average(latestScans.map(scan => scan.score_best_practices)),
      openIssues: snapshots.reduce((sum, row) => sum + row.openA11yIssues, 0),
      impactCounts: await countImpactBySeverity(pb, scanIds),
      trend: buildDailyTrend(trendScans, scan => toFiniteNumber(scan.score_overall)),
      issuesTrend: buildDailyTrend(trendScans, scan => toFiniteNumber(scan.open_issue_count))
    }
  }

  if (sections.includes('overview.qa')) {
    let brokenLinks = 0
    let misspellings = 0
    let policies = 0
    const readabilityScores: number[] = []
    for (const scanId of scanIds) {
      brokenLinks += await countCollection(pb, 'qa_broken_links', `scan = "${scanId}" && status != "dismissed"`)
      misspellings += await countCollection(pb, 'qa_spelling', `scan = "${scanId}" && status = "open"`)
      policies += await countCollection(pb, 'policy_matches', `scan = "${scanId}" && status = "open"`)
      const readability = await averageReadability(pb, scanId)
      if (readability != null) readabilityScores.push(readability)
    }

    result.qa = {
      score: average(latestScans.map(scan => scan.score_qa)),
      brokenLinks,
      misspellings,
      policies,
      avgReadability: readabilityScores.length
        ? Math.round(readabilityScores.reduce((sum, score) => sum + score, 0) / readabilityScores.length)
        : null
    }
  }

  if (sections.includes('overview.seo')) {
    let technicalIssues = 0
    let contentIssues = 0
    for (const scanId of scanIds) {
      technicalIssues += await countCollection(
        pb,
        'seo_issues',
        `scan = "${scanId}" && status = "open" && category = "technical"`
      )
      contentIssues += await countCollection(
        pb,
        'seo_issues',
        `scan = "${scanId}" && status = "open" && category = "content"`
      )
    }

    result.seo = {
      score: average(latestScans.map(scan => scan.score_seo)),
      technicalScore: average(latestScans.map(scan => scan.score_seo_technical)),
      contentScore: average(latestScans.map(scan => scan.score_seo_content)),
      crawlabilityScore: average(latestScans.map(scan => scan.score_seo_crawlability)),
      technicalIssues,
      contentIssues,
      seoTrend: buildDailyTrend(trendScans, scan => toFiniteNumber(scan.score_seo)),
      crawlabilityTrend: buildDailyTrend(trendScans, scan => toFiniteNumber(scan.score_seo_crawlability))
    }
  }

  if (sections.includes('overview.orgSummary') && job.include_all_sites) {
    result.orgSummary = {
      sites: snapshots,
      avgAccessibility: average(snapshots.map(row => row.accessibilityScore)),
      avgQa: average(snapshots.map(row => row.qaScore)),
      avgSeo: average(snapshots.map(row => row.seoScore)),
      totalOpenA11yIssues: snapshots.reduce((sum, row) => sum + row.openA11yIssues, 0),
      totalOpenQaIssues: snapshots.reduce((sum, row) => sum + row.openQaIssues, 0),
      totalOpenSeoIssues: snapshots.reduce((sum, row) => sum + row.openSeoIssues, 0)
    }
  }

  return result
}
