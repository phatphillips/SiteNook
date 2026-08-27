import type PocketBase from 'pocketbase'

type ScanLite = {
  id: string
  site: string
  completed_at?: string
  started_at?: string
  created?: string
  score_overall?: number
  score_qa?: number
  score_seo?: number
  open_issue_count?: number
}

type SiteLite = {
  id: string
  organization?: string
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function timestampOfScan(scan: ScanLite): string | null {
  return scan.completed_at ?? scan.started_at ?? scan.created ?? null
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v != null)
  if (!valid.length) return null
  const sum = valid.reduce((acc, n) => acc + n, 0)
  return Math.round((sum / valid.length) * 10) / 10
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

async function getExistingSummaryId(
  pb: PocketBase,
  collection: 'site_dashboard_summary' | 'org_dashboard_summary',
  filter: string
): Promise<string | null> {
  const list = await pb.collection(collection).getList(1, 1, { filter, fields: 'id' })
  return list.items[0]?.id ?? null
}

async function countCollection(pb: PocketBase, collection: string, filter: string): Promise<number> {
  try {
    const result = await pb.collection(collection).getList(1, 1, { filter, fields: 'id' })
    return result.totalItems
  } catch {
    return 0
  }
}

export async function recomputeSiteDashboardSummary(pb: PocketBase, siteId: string): Promise<void> {
  const site = await pb.collection('sites').getOne(siteId, { fields: 'id,organization' }) as SiteLite
  const orgId = typeof site.organization === 'string' ? site.organization.trim() : ''
  if (!orgId) return

  const scanList = await pb.collection('scans').getList(1, 1, {
    filter: `site = "${siteId}" && (status = "complete" || status = "complete_with_errors")`,
    sort: '-completed_at,-started_at',
    fields: 'id,site,completed_at,started_at,score_overall,score_qa,score_seo,open_issue_count'
  })
  const latest = (scanList.items[0] ?? null) as unknown as ScanLite | null

  let openQa = 0
  let openSeo = 0
  let openA11y = 0
  let sourceScanAt: string | null = null

  if (latest?.id) {
    openA11y = safeCount(latest.open_issue_count)
    openQa = (await countCollection(pb, 'qa_broken_links', `scan = "${latest.id}" && status != "dismissed"`))
      + (await countCollection(pb, 'qa_spelling', `scan = "${latest.id}" && status = "open"`))
    openSeo = await countCollection(pb, 'seo_issues', `scan = "${latest.id}" && status = "open"`)
    sourceScanAt = timestampOfScan(latest)
  }

  const scores = [
    toFiniteNumber(latest?.score_overall),
    toFiniteNumber(latest?.score_qa),
    toFiniteNumber(latest?.score_seo)
  ].filter((score): score is number => score != null)
  const attentionWorst = scores.length ? Math.min(...scores) : null

  const payload = {
    site: siteId,
    org: orgId,
    avg_accessibility: toFiniteNumber(latest?.score_overall),
    avg_qa: toFiniteNumber(latest?.score_qa),
    avg_seo: toFiniteNumber(latest?.score_seo),
    open_a11y_count: openA11y,
    open_qa_count: openQa,
    open_seo_count: openSeo,
    attention_worst_score: attentionWorst,
    attention_open_total: openA11y + openQa + openSeo,
    attention_last_scan_at: sourceScanAt,
    source_scan_at: sourceScanAt
  }

  const existingId = await getExistingSummaryId(pb, 'site_dashboard_summary', `site = "${siteId}"`)
  if (existingId) {
    await pb.collection('site_dashboard_summary').update(existingId, payload)
  } else {
    await pb.collection('site_dashboard_summary').create(payload)
  }
}

export async function recomputeOrgDashboardSummary(pb: PocketBase, orgId: string): Promise<void> {
  if (!orgId.trim()) return
  const rows = await pb.collection('site_dashboard_summary').getFullList({
    filter: `org = "${orgId}"`,
    fields: [
      'id',
      'avg_accessibility',
      'avg_qa',
      'avg_seo',
      'open_a11y_count',
      'open_qa_count',
      'open_seo_count',
      'attention_worst_score',
      'attention_open_total',
      'attention_last_scan_at',
      'source_scan_at'
    ].join(',')
  }) as Array<Record<string, unknown>>

  const avgAccessibility = average(rows.map(row => toFiniteNumber(row.avg_accessibility)))
  const avgQa = average(rows.map(row => toFiniteNumber(row.avg_qa)))
  const avgSeo = average(rows.map(row => toFiniteNumber(row.avg_seo)))
  const openA11y = rows.reduce((acc, row) => acc + safeCount(row.open_a11y_count), 0)
  const openQa = rows.reduce((acc, row) => acc + safeCount(row.open_qa_count), 0)
  const openSeo = rows.reduce((acc, row) => acc + safeCount(row.open_seo_count), 0)

  let attentionWorst: number | null = null
  let attentionLastScanAt: string | null = null
  let sourceScanAt: string | null = null
  for (const row of rows) {
    const score = toFiniteNumber(row.attention_worst_score)
    if (score != null && (attentionWorst == null || score < attentionWorst)) {
      attentionWorst = score
    }
    const lastScan = typeof row.attention_last_scan_at === 'string' ? row.attention_last_scan_at : null
    const sourceScan = typeof row.source_scan_at === 'string' ? row.source_scan_at : null
    if (lastScan && (!attentionLastScanAt || Date.parse(lastScan) > Date.parse(attentionLastScanAt))) {
      attentionLastScanAt = lastScan
    }
    if (sourceScan && (!sourceScanAt || Date.parse(sourceScan) > Date.parse(sourceScanAt))) {
      sourceScanAt = sourceScan
    }
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
  const existingId = await getExistingSummaryId(pb, 'org_dashboard_summary', `org = "${orgId}"`)
  if (existingId) {
    await pb.collection('org_dashboard_summary').update(existingId, payload)
  } else {
    await pb.collection('org_dashboard_summary').create(payload)
  }
}

export async function recomputeDashboardRollupsForSite(pb: PocketBase, siteId: string): Promise<void> {
  await recomputeSiteDashboardSummary(pb, siteId)
  const site = await pb.collection('sites').getOne(siteId, { fields: 'organization' }) as SiteLite
  const orgId = typeof site.organization === 'string' ? site.organization.trim() : ''
  if (orgId) {
    await recomputeOrgDashboardSummary(pb, orgId)
  }
}
