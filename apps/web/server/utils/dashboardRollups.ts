import type PocketBase from 'pocketbase'
import { recordRecompute } from './dashboardRollupTelemetry'

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v != null)
  if (!valid.length) return null
  return Math.round((valid.reduce((acc, n) => acc + n, 0) / valid.length) * 10) / 10
}

async function countCollection(pb: PocketBase, collection: string, filter: string): Promise<number> {
  try {
    const result = await pb.collection(collection).getList(1, 1, { filter, fields: 'id' })
    return result.totalItems
  } catch {
    return 0
  }
}

async function getSummaryId(
  pb: PocketBase,
  collection: 'site_dashboard_summary' | 'org_dashboard_summary',
  filter: string
): Promise<string | null> {
  const list = await pb.collection(collection).getList(1, 1, { filter, fields: 'id' })
  return list.items[0]?.id ?? null
}

export async function recomputeSiteDashboardSummary(pb: PocketBase, siteId: string): Promise<void> {
  const site = await pb.collection('sites').getOne(siteId, { fields: 'id,organization' }) as {
    id: string
    organization?: string
  }
  const orgId = typeof site.organization === 'string' ? site.organization.trim() : ''
  if (!orgId) return

  const latestScanList = await pb.collection('scans').getList(1, 1, {
    filter: `site = "${siteId}" && (status = "complete" || status = "complete_with_errors")`,
    sort: '-completed_at,-started_at,-created',
    fields: 'id,score_overall,score_qa,score_seo,open_issue_count,completed_at,started_at,created'
  })
  const latestScan = latestScanList.items[0] as
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

  const sourceScanAt = latestScan
    ? (latestScan.completed_at ?? latestScan.started_at ?? latestScan.created ?? null)
    : null

  let openQa = 0
  let openSeo = 0
  if (latestScan?.id) {
    openQa = (await countCollection(pb, 'qa_broken_links', `scan = "${latestScan.id}" && status != "dismissed"`))
      + (await countCollection(pb, 'qa_spelling', `scan = "${latestScan.id}" && status = "open"`))
    openSeo = await countCollection(pb, 'seo_issues', `scan = "${latestScan.id}" && status = "open"`)
  }
  const openA11y = safeCount(latestScan?.open_issue_count)
  const scores = [toFiniteNumber(latestScan?.score_overall), toFiniteNumber(latestScan?.score_qa), toFiniteNumber(latestScan?.score_seo)]
    .filter((score): score is number => score != null)
  const worst = scores.length ? Math.min(...scores) : null

  const payload = {
    site: siteId,
    org: orgId,
    avg_accessibility: toFiniteNumber(latestScan?.score_overall),
    avg_qa: toFiniteNumber(latestScan?.score_qa),
    avg_seo: toFiniteNumber(latestScan?.score_seo),
    open_a11y_count: openA11y,
    open_qa_count: openQa,
    open_seo_count: openSeo,
    attention_worst_score: worst,
    attention_open_total: openA11y + openQa + openSeo,
    attention_last_scan_at: sourceScanAt,
    source_scan_at: sourceScanAt
  }

  const summaryId = await getSummaryId(pb, 'site_dashboard_summary', `site = "${siteId}"`)
  if (summaryId) await pb.collection('site_dashboard_summary').update(summaryId, payload)
  else await pb.collection('site_dashboard_summary').create(payload)
}

export async function recomputeOrgDashboardSummary(pb: PocketBase, orgId: string): Promise<void> {
  const rows = await pb.collection('site_dashboard_summary').getFullList({
    filter: `org = "${orgId}"`,
    fields: 'avg_accessibility,avg_qa,avg_seo,open_a11y_count,open_qa_count,open_seo_count,attention_worst_score,attention_last_scan_at,source_scan_at'
  }) as Array<Record<string, unknown>>
  const avgAccessibility = average(rows.map(r => toFiniteNumber(r.avg_accessibility)))
  const avgQa = average(rows.map(r => toFiniteNumber(r.avg_qa)))
  const avgSeo = average(rows.map(r => toFiniteNumber(r.avg_seo)))
  const openA11y = rows.reduce((acc, r) => acc + safeCount(r.open_a11y_count), 0)
  const openQa = rows.reduce((acc, r) => acc + safeCount(r.open_qa_count), 0)
  const openSeo = rows.reduce((acc, r) => acc + safeCount(r.open_seo_count), 0)

  let attentionWorst: number | null = null
  let attentionLastScanAt: string | null = null
  let sourceScanAt: string | null = null
  for (const row of rows) {
    const score = toFiniteNumber(row.attention_worst_score)
    if (score != null && (attentionWorst == null || score < attentionWorst)) attentionWorst = score
    const lastScan = typeof row.attention_last_scan_at === 'string' ? row.attention_last_scan_at : null
    const sourceScan = typeof row.source_scan_at === 'string' ? row.source_scan_at : null
    if (lastScan && (!attentionLastScanAt || Date.parse(lastScan) > Date.parse(attentionLastScanAt))) attentionLastScanAt = lastScan
    if (sourceScan && (!sourceScanAt || Date.parse(sourceScan) > Date.parse(sourceScanAt))) sourceScanAt = sourceScan
  }

  const payload = {
    org: orgId,
    avg_accessibility: avgAccessibility,
    avg_qa: avgQa,
    avg_seo: avgSeo,
    open_a11y_count: openA11y,
    open_qa_count: openQa,
    open_seo_count: openSeo,
    attention_worst_score: attentionWorst,
    attention_open_total: openA11y + openQa + openSeo,
    attention_last_scan_at: attentionLastScanAt,
    source_scan_at: sourceScanAt
  }
  const summaryId = await getSummaryId(pb, 'org_dashboard_summary', `org = "${orgId}"`)
  if (summaryId) await pb.collection('org_dashboard_summary').update(summaryId, payload)
  else await pb.collection('org_dashboard_summary').create(payload)
}

export async function recomputeDashboardRollupsForSite(pb: PocketBase, siteId: string): Promise<void> {
  const started = Date.now()
  await recomputeSiteDashboardSummary(pb, siteId)
  const site = await pb.collection('sites').getOne(siteId, { fields: 'organization' }) as { organization?: string }
  const orgId = typeof site.organization === 'string' ? site.organization.trim() : ''
  if (orgId) {
    await recomputeOrgDashboardSummary(pb, orgId)
  }
  recordRecompute(Date.now() - started)
}
