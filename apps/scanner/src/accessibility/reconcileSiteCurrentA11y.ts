import type PocketBase from 'pocketbase'
import {
  issueInSiteTarget,
  parseSiteTargetSettings,
  siteTargetSnapshot
} from '../accessibility/siteTarget.js'
import {
  buildA11ySummary,
  type A11ySummary,
  type A11ySummaryIssueInput
} from '../accessibility/buildA11ySummary.js'
import type { ElementTotals } from '../accessibility/siteimproveScore.js'
import { chunkPageIds, pbOrPageIds } from '../accessibility/a11yQueryFields.js'
import { normalizePageUrl } from '../search/urlKey.js'

const A11Y_PAGE_FIELDS =
  'id,url,title,scan,site,expand.scan.completed_at,expand.scan.started_at,expand.scan.created'
const A11Y_ISSUE_FIELDS =
  'id,scan,page,rule_id,wcag_level,wcag_version,wcag_sc,impact,type,element_type,responsible_role,description,status'

interface SlimPageRow {
  id: string
  url: string
  title?: string
  expand?: {
    scan?: { completed_at?: string, created?: string, started_at?: string }
  }
}

function pageRowTimestamp(page: SlimPageRow): number {
  const scan = page.expand?.scan
  const raw = scan?.completed_at ?? scan?.started_at ?? scan?.created
  if (!raw) return 0
  const ms = Date.parse(String(raw))
  return Number.isFinite(ms) ? ms : 0
}

export async function loadLatestSlimPages(
  pb: PocketBase,
  siteId: string
): Promise<SlimPageRow[]> {
  const pages = await pb.collection('pages').getFullList({
    filter: `site = "${siteId}"`,
    expand: 'scan',
    fields: A11Y_PAGE_FIELDS
  }) as unknown as SlimPageRow[]

  const latestByKey = new Map<string, SlimPageRow>()
  for (const page of pages) {
    const key = normalizePageUrl(page.url)
    const existing = latestByKey.get(key)
    if (!existing || pageRowTimestamp(page) >= pageRowTimestamp(existing)) {
      latestByKey.set(key, page)
    }
  }
  return [...latestByKey.values()]
}

async function loadIssuesForPages(
  pb: PocketBase,
  pages: SlimPageRow[]
): Promise<A11ySummaryIssueInput[]> {
  if (!pages.length) return []

  const pageById = new Map(pages.map(p => [p.id, p]))
  const batches = chunkPageIds(pages.map(p => p.id))
  const records = (
    await Promise.all(
      batches.map(batch =>
        pb.collection('accessibility_issues').getFullList({
          filter: pbOrPageIds(batch),
          fields: A11Y_ISSUE_FIELDS
        })
      )
    )
  ).flat() as Array<A11ySummaryIssueInput & { page: string }>

  return records.map(record => ({
    id: record.id,
    rule_id: record.rule_id,
    wcag_level: record.wcag_level,
    wcag_version: record.wcag_version,
    wcag_sc: record.wcag_sc,
    impact: record.impact,
    type: record.type,
    description: record.description,
    element_type: record.element_type,
    responsible_role: record.responsible_role,
    status: record.status,
    page_url: pageById.get(record.page)?.url
  }))
}

export async function reconcileSiteCurrentA11y(
  pb: PocketBase,
  siteId: string,
  elementTotals?: ElementTotals
): Promise<A11ySummary> {
  const site = await pb.collection('sites').getOne(siteId, {
    fields: 'score_denominators,site_settings,default_scan_config'
  }) as {
    score_denominators?: { elements?: ElementTotals }
    site_settings?: Record<string, unknown>
    default_scan_config?: Record<string, unknown>
  }

  const siteTarget = parseSiteTargetSettings(site.site_settings, site.default_scan_config)
  const latestPages = await loadLatestSlimPages(pb, siteId)
  const allIssues = await loadIssuesForPages(pb, latestPages)
  const issues = allIssues.filter(issue => issueInSiteTarget(issue, siteTarget))

  let totals = elementTotals ?? site.score_denominators?.elements
  if (!totals) totals = site.score_denominators?.elements

  const summary = buildA11ySummary(issues, {
    pageCount: latestPages.length,
    elementTotals: totals,
    includePagesBreakdown: true,
    siteTarget: siteTargetSnapshot(siteTarget)
  })

  await pb.collection('sites').update(siteId, { current_a11y: summary })
  return summary
}

export async function rebuildScanA11ySummaryFromPb(
  pb: PocketBase,
  scan: { id: string, site: string, pages_crawled?: number, score_denominators?: { elements?: ElementTotals } }
): Promise<A11ySummary> {
  const pages = await pb.collection('pages').getFullList({
    filter: `scan = "${scan.id}"`,
    fields: 'id,url'
  }) as Array<{ id: string, url: string }>

  const pageUrlById = new Map(pages.map(p => [p.id, p.url]))
  const pageIds = pages.map(p => p.id)

  if (!pageIds.length) {
    const empty = buildA11ySummary([], {
      pageCount: 0,
      elementTotals: scan.score_denominators?.elements
    })
    await pb.collection('scans').update(scan.id, { a11y_summary: empty })
    return empty
  }

  const batches = chunkPageIds(pageIds)
  const issueRecords = (
    await Promise.all(
      batches.map(batch =>
        pb.collection('accessibility_issues').getFullList({
          filter: pbOrPageIds(batch),
          fields: 'id,page,rule_id,wcag_level,wcag_version,wcag_sc,impact,type,element_type,description,status'
        })
      )
    )
  ).flat() as Array<A11ySummaryIssueInput & { page: string }>

  const summary = buildA11ySummary(
    issueRecords.map(r => ({
      id: r.id,
      rule_id: r.rule_id,
      wcag_level: r.wcag_level,
      wcag_version: r.wcag_version,
      wcag_sc: r.wcag_sc,
      impact: r.impact,
      type: r.type,
      description: r.description,
      element_type: r.element_type,
      status: r.status,
      page_url: pageUrlById.get(r.page)
    })),
    {
      pageCount: scan.pages_crawled ?? pages.length,
      elementTotals: scan.score_denominators?.elements
    }
  )

  await pb.collection('scans').update(scan.id, { a11y_summary: summary })
  return summary
}

export async function buildScanA11ySummary(
  pb: PocketBase,
  scanId: string,
  siteId: string,
  pageCount: number,
  issues: A11ySummaryIssueInput[],
  elementTotals?: ElementTotals
): Promise<A11ySummary> {
  void siteId
  let totals = elementTotals
  if (!totals) {
    const scan = await pb.collection('scans').getOne(scanId, {
      fields: 'score_denominators'
    }) as { score_denominators?: { elements?: ElementTotals } }
    totals = scan.score_denominators?.elements
  }

  return buildA11ySummary(issues, {
    pageCount,
    elementTotals: totals,
    includePagesBreakdown: false
  })
}
