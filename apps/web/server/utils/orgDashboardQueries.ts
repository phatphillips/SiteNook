import type PocketBase from 'pocketbase'
import type { OrgDashboardAggregates, SiteDashboardSnapshot } from '~/utils/dashboardAggregates'
import { aggregateOrgDashboard, sortSnapshotsByLastScan } from '~/utils/dashboardAggregates'
import { recomputeDashboardRollupsForSite } from './dashboardRollups'
import { recordFallbackRead, recordStaleRead } from './dashboardRollupTelemetry'

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

export interface OrgDashboardQueryResult {
  aggregates: OrgDashboardAggregates
  source: 'summary' | 'fallback' | 'mixed'
  dataAsOf: string | null
  staleSites: string[]
}

export async function queryOrgDashboard(
  pb: PocketBase,
  orgId: string,
  options?: { staleAfterMs?: number }
): Promise<OrgDashboardQueryResult> {
  const staleAfterMs = options?.staleAfterMs ?? 10 * 60 * 1000
  const nowMs = Date.now()
  const sites = await pb.collection('sites').getFullList({
    filter: `organization = "${orgId}"`,
    sort: 'name',
    fields: 'id,name,url,current_a11y'
  }) as Array<{ id: string, name: string, url: string, current_a11y?: { open_issue_count?: number } }>

  const summaries = await pb.collection('site_dashboard_summary').getFullList({
    filter: `org = "${orgId}"`,
    fields: 'site,avg_accessibility,avg_qa,avg_seo,open_a11y_count,open_qa_count,open_seo_count,attention_last_scan_at,updated'
  }) as Array<Record<string, unknown>>
  const summaryBySite = new Map<string, Record<string, unknown>>()
  for (const row of summaries) {
    const siteId = typeof row.site === 'string' ? row.site : ''
    if (siteId) summaryBySite.set(siteId, row)
  }

  const staleSites: string[] = []
  const snapshots: SiteDashboardSnapshot[] = []
  let usedSummary = 0
  let usedFallback = 0
  let dataAsOf: string | null = null

  for (const site of sites) {
    const summary = summaryBySite.get(site.id)
    const updatedAt = typeof summary?.updated === 'string' ? summary.updated : null
    const isStale = !updatedAt || (nowMs - Date.parse(updatedAt)) > staleAfterMs
    if (isStale) staleSites.push(site.id)

    if (summary && !isStale) {
      usedSummary++
      if (!dataAsOf || (updatedAt && Date.parse(updatedAt) > Date.parse(dataAsOf))) {
        dataAsOf = updatedAt
      }
      snapshots.push({
        siteId: site.id,
        siteName: site.name,
        siteUrl: site.url,
        accessibilityScore: toNumberOrNull(summary.avg_accessibility),
        qaScore: toNumberOrNull(summary.avg_qa),
        seoScore: toNumberOrNull(summary.avg_seo),
        openA11yIssues: toCount(summary.open_a11y_count),
        openQaIssues: toCount(summary.open_qa_count),
        openSeoIssues: toCount(summary.open_seo_count),
        brokenLinkCount: 0,
        misspellingCount: 0,
        technicalSeoCount: 0,
        contentSeoCount: 0,
        lastScanAt: typeof summary.attention_last_scan_at === 'string' ? summary.attention_last_scan_at : null
      })
      continue
    }

    usedFallback++
    const scanList = await pb.collection('scans').getList(1, 1, {
      filter: `site = "${site.id}" && (status = "complete" || status = "complete_with_errors")`,
      sort: '-completed_at,-started_at,-created',
      fields: 'id,score_overall,score_qa,score_seo,open_issue_count,completed_at,started_at,created'
    })
    const scan = scanList.items[0] as
      | {
        id: string
        score_overall?: number
        score_qa?: number
        score_seo?: number
        open_issue_count?: number
        completed_at?: string
        started_at?: string
        created?: string
      }
      | undefined

    let brokenLinkCount = 0
    let misspellingCount = 0
    let technicalSeoCount = 0
    let contentSeoCount = 0
    if (scan?.id) {
      const [broken, spelling, technical, content] = await Promise.all([
        pb.collection('qa_broken_links').getList(1, 1, { filter: `scan = "${scan.id}" && status != "dismissed"`, fields: 'id' }),
        pb.collection('qa_spelling').getList(1, 1, { filter: `scan = "${scan.id}" && status = "open"`, fields: 'id' }),
        pb.collection('seo_issues').getList(1, 1, { filter: `scan = "${scan.id}" && status = "open" && category = "technical"`, fields: 'id' }),
        pb.collection('seo_issues').getList(1, 1, { filter: `scan = "${scan.id}" && status = "open" && category = "content"`, fields: 'id' })
      ])
      brokenLinkCount = broken.totalItems
      misspellingCount = spelling.totalItems
      technicalSeoCount = technical.totalItems
      contentSeoCount = content.totalItems
    }
    snapshots.push({
      siteId: site.id,
      siteName: site.name,
      siteUrl: site.url,
      accessibilityScore: toNumberOrNull(scan?.score_overall),
      qaScore: toNumberOrNull(scan?.score_qa),
      seoScore: toNumberOrNull(scan?.score_seo),
      openA11yIssues: toCount(scan?.open_issue_count ?? site.current_a11y?.open_issue_count),
      openQaIssues: brokenLinkCount + misspellingCount,
      openSeoIssues: technicalSeoCount + contentSeoCount,
      brokenLinkCount,
      misspellingCount,
      technicalSeoCount,
      contentSeoCount,
      lastScanAt: scan ? (scan.completed_at ?? scan.started_at ?? scan.created ?? null) : null
    })
  }

  if (staleSites.length) recordStaleRead(staleSites.length)
  if (usedFallback) recordFallbackRead(usedFallback)

  // Fire-and-forget background repair for missing/stale summaries.
  for (const siteId of staleSites) {
    void recomputeDashboardRollupsForSite(pb, siteId).catch(() => {})
  }

  const aggregates = aggregateOrgDashboard(sortSnapshotsByLastScan(snapshots))
  const source: OrgDashboardQueryResult['source']
    = usedSummary > 0 && usedFallback > 0 ? 'mixed' : usedSummary > 0 ? 'summary' : 'fallback'
  return { aggregates, source, dataAsOf, staleSites }
}
