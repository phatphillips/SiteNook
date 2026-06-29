import type PocketBase from 'pocketbase'
import type { A11ySummary } from '~/utils/a11ySummary'
import type { AccessibilityIssue, Scan } from '~/types/accessiq'
import {
  attachPageMetaToIssues,
  pageUrlMapFromRows,
  type A11yPageRow
} from '~/utils/a11yPageMeta'
import {
  A11Y_ISSUE_LIST_FIELDS,
  A11Y_PAGE_FIELDS,
  chunkPageIds,
  pbOrPageIds
} from '~/utils/a11yQueryFields'
import { buildA11ySummaryFromIssues } from './buildA11ySummary'
import { pbRelation } from '~/utils/pbFilter'
import { latestPageIdsByNormalizedUrl } from '~/utils/pageUrl'
import type { ElementTotals } from '~/utils/siteimproveScore'
import { issueInSiteTarget, parseSiteSettings, siteTargetSnapshot } from '~/utils/siteSettings'

function pageActivityTimestamp(page: A11yPageRow): number {
  const scan = page.expand?.scan
  if (scan) {
    const raw = scan.completed_at ?? scan.started_at ?? scan.created
    if (raw) {
      const ms = Date.parse(String(raw))
      if (Number.isFinite(ms)) return ms
    }
  }
  if (page.created) {
    const ms = Date.parse(page.created)
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

async function loadLatestPagesAndIssues(
  pb: PocketBase,
  siteId: string
): Promise<{ pages: A11yPageRow[], issues: AccessibilityIssue[] }> {
  const pages = await pb.collection('pages').getFullList({
    filter: pbRelation('site', siteId),
    expand: 'scan',
    fields: A11Y_PAGE_FIELDS
  }) as unknown as A11yPageRow[]

  const allowedIds = latestPageIdsByNormalizedUrl(
    pages.map(page => ({
      id: page.id,
      url: page.url,
      ts: pageActivityTimestamp(page)
    }))
  )

  const latestPages = pages.filter(p => allowedIds.has(p.id))
  if (!latestPages.length) {
    return { pages: [], issues: [] }
  }

  const batches = chunkPageIds([...allowedIds])
  const issueRows = (
    await Promise.all(
      batches.map(batch =>
        pb.collection('accessibility_issues').getFullList({
          filter: pbOrPageIds(batch),
          fields: A11Y_ISSUE_LIST_FIELDS
        })
      )
    )
  ).flat() as unknown as AccessibilityIssue[]

  attachPageMetaToIssues(issueRows, pageUrlMapFromRows(pages))
  return { pages: latestPages, issues: issueRows }
}

export async function reconcileSiteCurrentA11y(
  pb: PocketBase,
  siteId: string
): Promise<A11ySummary> {
  const site = await pb.collection('sites').getOne(siteId, {
    fields: 'score_denominators,site_settings,default_scan_config'
  }) as {
    score_denominators?: { elements?: Record<string, number> }
    site_settings?: Record<string, unknown>
    default_scan_config?: Record<string, unknown>
  }

  const siteSettings = parseSiteSettings(site.site_settings, site.default_scan_config)
  const { pages, issues: allIssues } = await loadLatestPagesAndIssues(pb, siteId)
  const issues = allIssues.filter(issue => issueInSiteTarget(issue, siteSettings))
  const summary = buildA11ySummaryFromIssues(issues, {
    pageCount: pages.length,
    elementTotals: site.score_denominators?.elements as ElementTotals | undefined,
    includePagesBreakdown: true,
    siteTarget: siteTargetSnapshot(siteSettings)
  })

  await pb.collection('sites').update(siteId, { current_a11y: summary })
  return summary
}

export async function rebuildScanA11ySummaryFromPb(
  pb: PocketBase,
  scan: Pick<Scan, 'id' | 'pages_crawled' | 'score_denominators'>
): Promise<A11ySummary> {
  const pages = await pb.collection('pages').getFullList({
    filter: pbRelation('scan', scan.id),
    fields: 'id,url'
  }) as Array<{ id: string, url: string }>

  const pageUrlById = new Map(pages.map(p => [p.id, p.url]))
  const pageIds = pages.map(p => p.id)
  if (!pageIds.length) {
    const empty = buildA11ySummaryFromIssues([], {
      pageCount: 0,
      elementTotals: scan.score_denominators?.elements
    })
    await pb.collection('scans').update(scan.id, { a11y_summary: empty })
    return empty
  }

  const batches = chunkPageIds(pageIds)
  const issues = (
    await Promise.all(
      batches.map(batch =>
        pb.collection('accessibility_issues').getFullList({
          filter: pbOrPageIds(batch),
          fields: A11Y_ISSUE_LIST_FIELDS
        })
      )
    )
  ).flat() as unknown as AccessibilityIssue[]

  for (const issue of issues) {
    const url = pageUrlById.get(issue.page)
    if (url) {
      issue.expand = { page: { url } }
    }
  }

  const summary = buildA11ySummaryFromIssues(issues, {
    pageCount: scan.pages_crawled ?? pages.length,
    elementTotals: scan.score_denominators?.elements as ElementTotals | undefined
  })

  await pb.collection('scans').update(scan.id, { a11y_summary: summary })
  return summary
}
