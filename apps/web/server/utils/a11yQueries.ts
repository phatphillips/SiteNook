import type PocketBase from 'pocketbase'
import type { AccessibilityIssue, Scan } from '~/types/sitenook'
import { isA11ySummaryFresh, type A11ySummary } from '~/utils/a11ySummary'
import { attachPageMetaToIssues, pageUrlMapFromRows, type A11yPageRow } from '~/utils/a11yPageMeta'
import type { AffectedPageSummary } from '~/utils/affectedPages'
import { affectedPagesSummaryForRule } from '~/utils/affectedPages'
import { A11Y_ISSUE_LIST_FIELDS, A11Y_PAGE_FIELDS, A11Y_SCAN_LIST_FIELDS, chunkPageIds, pbOrPageIds } from '~/utils/a11yQueryFields'
import { uniqueByRule, countOpenOccurrences } from '~/utils/accessibilityIssues'
import { buildPointsToGainByRule } from '~/utils/a11yScoring'
import { latestPageIdsByNormalizedUrl } from '~/utils/pageUrl'
import { pbRelation } from '~/utils/pbFilter'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import { pickLatestTrustedScan, scanTimestamp } from '~/utils/scanDisplay'
import { parseA11yCheckStats } from '~/utils/a11yCheckStats'
import { classifyIssueCategory, issueInSiteTarget, parseSiteSettings, siteTargetSnapshotsEqual } from '~/utils/siteSettings'
import type { ElementTotals } from '~/utils/siteimproveScore'
import {
  getCachedAffectedPages,
  getCachedIssuesResponse,
  invalidateIssuesCache,
  setCachedAffectedPages,
  setCachedIssuesResponse
} from './a11yIssuesCache'
import { issueFromSummaryRow, queryIssuesFromSummary, type A11yRuleStats } from './a11ySummaryQuery'

export interface A11yIssuesQuery {
  page?: number
  perPage?: number
  search?: string
  wcagLevel?: string
  wcagLevels?: string[]
  impacts?: string[]
  types?: string[]
  elements?: string[]
  roles?: string[]
  targetCategories?: string[]
  statuses?: string[]
}

export interface A11yIssuesQueryResult {
  items: AccessibilityIssue[]
  total: number
  page: number
  perPage: number
  openUniqueCount: number
  openOccurrencesCount: number
  occurrencesCount: number
  pointsToGainByRule: Record<string, number>
  ruleStats: Record<string, A11yRuleStats>
  currentA11y: A11ySummary | null
  source: 'summary' | 'full'
}

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

export async function loadLatestPageIdsForSite(
  pb: PocketBase,
  siteId: string
): Promise<{ pageIds: Set<string>, pageById: Map<string, { url: string, title?: string }> }> {
  const pages = await pb.collection('pages').getFullList({
    filter: pbRelation('site', siteId),
    expand: 'scan',
    fields: A11Y_PAGE_FIELDS
  }) as unknown as A11yPageRow[]

  const pageIds = latestPageIdsByNormalizedUrl(
    pages.map(page => ({
      id: page.id,
      url: page.url,
      ts: pageActivityTimestamp(page)
    }))
  )

  return { pageIds, pageById: pageUrlMapFromRows(pages) }
}

async function loadIssuesForLatestPages(
  pb: PocketBase,
  pageIds: Set<string>
): Promise<AccessibilityIssue[]> {
  if (!pageIds.size) return []
  const batches = chunkPageIds([...pageIds])
  const results = await Promise.all(
    batches.map(batch =>
      pb.collection('accessibility_issues').getFullList({
        filter: pbOrPageIds(batch),
        fields: A11Y_ISSUE_LIST_FIELDS
      })
    )
  )
  return results.flat() as unknown as AccessibilityIssue[]
}

function applyIssueFilters(
  issues: AccessibilityIssue[],
  query: A11yIssuesQuery,
  siteSettings: ReturnType<typeof parseSiteSettings>
): AccessibilityIssue[] {
  return issues.filter((issue) => {
    if (!issueInSiteTarget(issue, siteSettings)) return false

    const levelFilter = query.wcagLevels?.length
      ? query.wcagLevels
      : (query.wcagLevel && query.wcagLevel !== 'All' ? [query.wcagLevel] : [])

    if (levelFilter.length && !levelFilter.includes(issue.wcag_level)) return false

    if (query.targetCategories?.length) {
      if (!query.targetCategories.includes(classifyIssueCategory(issue))) return false
    }

    if (query.impacts?.length) {
      const allowed = new Set(query.impacts)
      if (allowed.has('critical')) allowed.add('serious')
      if (!allowed.has(issue.impact)) return false
    }

    if (query.types?.length && !query.types.includes(issue.type)) return false
    if (query.elements?.length && issue.element_type && !query.elements.includes(issue.element_type)) return false
    if (query.roles?.length && issue.responsible_role && !query.roles.includes(issue.responsible_role)) return false

    const statuses = query.statuses?.length ? query.statuses : ['open']
    if (statuses.length && !statuses.includes(issue.status)) return false

    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase()
      const hay = `${issue.rule_id} ${issue.description}`.toLowerCase()
      if (!hay.includes(q)) return false
    }

    return true
  })
}

async function loadLatestCheckStats(pb: PocketBase, siteId: string) {
  const scans = await pb.collection('scans').getFullList({
    filter: pbRelation('site', siteId),
    fields: 'id,status,completed_at,started_at,created,a11y_check_stats,scan_quality'
  }) as unknown as Scan[]
  const latest = pickLatestTrustedScan(scans)
  return parseA11yCheckStats(latest?.a11y_check_stats) ?? latest?.a11y_check_stats ?? null
}

function emptyIssuesResult(query: A11yIssuesQuery, currentA11y: A11ySummary | null): A11yIssuesQueryResult {
  return {
    items: [],
    total: 0,
    page: query.page ?? 1,
    perPage: query.perPage ?? 20,
    openUniqueCount: 0,
    openOccurrencesCount: 0,
    occurrencesCount: 0,
    pointsToGainByRule: {},
    ruleStats: {},
    currentA11y,
    source: 'summary'
  }
}

async function queryAccessibilityIssuesFull(
  pb: PocketBase,
  siteId: string,
  query: A11yIssuesQuery,
  site: {
    score_denominators?: { elements?: Record<string, number> }
    current_a11y?: A11ySummary | null
  },
  siteSettings: ReturnType<typeof parseSiteSettings>
): Promise<A11yIssuesQueryResult> {
  const { pageIds, pageById } = await loadLatestPageIdsForSite(pb, siteId)
  if (!pageIds.size) return emptyIssuesResult(query, site.current_a11y ?? null)

  const allIssues = await loadIssuesForLatestPages(pb, pageIds)
  attachPageMetaToIssues(allIssues, pageById)

  const openIssues = allIssues.filter(i => i.status === 'open')
  const targetOpenIssues = openIssues.filter(i => issueInSiteTarget(i, siteSettings))
  const filtered = applyIssueFilters(allIssues, query, siteSettings)
  const filteredOpen = filtered.filter(i => i.status === 'open')
  const unique = uniqueByRule(filteredOpen)

  const impactOrder: Record<string, number> = { critical: 4, serious: 3, moderate: 2, minor: 1 }
  unique.sort((a, b) => (impactOrder[b.impact] || 0) - (impactOrder[a.impact] || 0))

  const page = Math.max(1, query.page ?? 1)
  const perPage = Math.min(100, Math.max(1, query.perPage ?? 20))
  const start = (page - 1) * perPage
  const items = unique.slice(start, start + perPage)

  const scoreable = allIssues.filter(
    i => (i.status === 'open' || i.status === 'dismissed') && issueInSiteTarget(i, siteSettings)
  )
  const checkStats = await loadLatestCheckStats(pb, siteId)
  const pointsToGainByRule = Object.fromEntries(
    buildPointsToGainByRule(
      scoreable,
      site.score_denominators?.elements as ElementTotals | undefined,
      checkStats
    )
  )

  const ruleStats: Record<string, A11yRuleStats> = {}
  for (const row of uniqueByRule(targetOpenIssues)) {
    const pages = affectedPagesSummaryForRule(targetOpenIssues, row.rule_id, { statuses: ['open'] })
    ruleStats[row.rule_id] = {
      pages: pages.length,
      occurrences: pages.reduce((sum, p) => sum + p.occurrences, 0)
    }
  }

  return {
    items,
    total: unique.length,
    page,
    perPage,
    openUniqueCount: uniqueByRule(targetOpenIssues).length,
    openOccurrencesCount: countOpenOccurrences(targetOpenIssues),
    occurrencesCount: countOpenOccurrences(filteredOpen),
    pointsToGainByRule,
    ruleStats,
    currentA11y: site.current_a11y ?? null,
    source: 'full'
  }
}

export async function queryAccessibilityIssues(
  pb: PocketBase,
  siteId: string,
  query: A11yIssuesQuery
): Promise<A11yIssuesQueryResult> {
  const cached = getCachedIssuesResponse(siteId, query)
  if (cached) return cached as A11yIssuesQueryResult

  const [site, latestScan] = await Promise.all([
    pb.collection('sites').getOne(siteId, {
      fields: 'score_denominators,site_settings,default_scan_config,current_a11y'
    }) as Promise<{
      score_denominators?: { elements?: Record<string, number> }
      site_settings?: Record<string, unknown>
      default_scan_config?: Record<string, unknown>
      current_a11y?: A11ySummary | null
    }>,
    pb.collection('scans').getList(1, 1, {
      filter: `${pbRelation('site', siteId)} && (status = "complete" || status = "complete_with_errors")`,
      sort: '-completed_at',
      fields: 'id,completed_at,started_at,scan_quality'
    }).catch(() => ({ items: [] as Array<{ completed_at?: string, started_at?: string, scan_quality?: { trusted?: boolean } }> }))
  ])

  const siteSettings = parseSiteSettings(site.site_settings, site.default_scan_config)
  const summary = site.current_a11y
  const latest = latestScan.items[0] as { completed_at?: string, started_at?: string, scan_quality?: { trusted?: boolean } } | undefined
  const latestCompletedAt = latest?.completed_at ?? latest?.started_at
  const summaryFresh = isA11ySummaryFresh(summary, latestCompletedAt)
    && latest?.scan_quality?.trusted !== false

  let result: A11yIssuesQueryResult
  if (
    summaryFresh
    && summary?.by_rule?.length
    && siteTargetSnapshotsEqual(summary.site_target, siteSettings)
  ) {
    const fromSummary = queryIssuesFromSummary(summary, query, siteSettings)
    result = { ...fromSummary, source: 'summary' }
  } else {
    if (summary && !summaryFresh) invalidateIssuesCache(siteId)
    result = await queryAccessibilityIssuesFull(pb, siteId, query, site, siteSettings)
  }

  setCachedIssuesResponse(siteId, query, result)
  return result
}

export async function loadAffectedPagesForRule(
  pb: PocketBase,
  siteId: string,
  ruleId: string,
  options?: { statuses?: Array<AccessibilityIssue['status']> }
): Promise<AffectedPageSummary[]> {
  const statuses = options?.statuses ?? ['open']
  const cached = getCachedAffectedPages(siteId, ruleId, statuses)
  if (cached) return cached

  const site = await pb.collection('sites').getOne(siteId, {
    fields: 'site_settings,default_scan_config'
  }) as { site_settings?: Record<string, unknown>, default_scan_config?: Record<string, unknown> }

  const siteSettings = parseSiteSettings(site.site_settings, site.default_scan_config)
  const { pageIds, pageById } = await loadLatestPageIdsForSite(pb, siteId)
  if (!pageIds.size) {
    setCachedAffectedPages(siteId, ruleId, statuses, [])
    return []
  }

  const batches = chunkPageIds([...pageIds])
  const issues = (
    await Promise.all(
      batches.map(batch =>
        pb.collection('accessibility_issues').getFullList({
          filter: `rule_id = "${ruleId}" && (${pbOrPageIds(batch)})`,
          fields: A11Y_ISSUE_LIST_FIELDS
        })
      )
    )
  ).flat() as unknown as AccessibilityIssue[]

  attachPageMetaToIssues(issues, pageById)
  const filtered = issues.filter(
    issue => issueInSiteTarget(issue, siteSettings) && statuses.includes(issue.status)
  )
  const pages = affectedPagesSummaryForRule(filtered, ruleId, { statuses })
  setCachedAffectedPages(siteId, ruleId, statuses, pages)
  return pages
}

export async function queryAccessibilityOverview(
  pb: PocketBase,
  siteId: string,
  options?: { from?: string, to?: string }
) {
  const site = await pb.collection('sites').getOne(siteId, {
    fields: 'score_denominators,current_a11y,site_settings,default_scan_config'
  }) as {
    score_denominators?: Record<string, unknown>
    current_a11y?: A11ySummary | null
    site_settings?: Record<string, unknown>
    default_scan_config?: Record<string, unknown>
  }

  const scans = await pb.collection('scans').getFullList({
    filter: pbRelation('site', siteId),
    fields: A11Y_SCAN_LIST_FIELDS
  }) as unknown as Scan[]

  let filtered = scans.slice().sort((a, b) =>
    compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b))
  )

  if (options?.from || options?.to) {
    const fromMs = options.from ? Date.parse(options.from) : 0
    const toMs = options.to ? Date.parse(options.to) : Number.POSITIVE_INFINITY
    filtered = filtered.filter((scan) => {
      const ts = Date.parse(String(scan.completed_at ?? scan.started_at ?? scan.created ?? ''))
      if (!Number.isFinite(ts)) return false
      return ts >= fromMs && ts <= toMs
    })
  }

  return {
    scans: filtered,
    currentA11y: site.current_a11y ?? null,
    scoreDenominators: site.score_denominators ?? null,
    siteSettings: parseSiteSettings(site.site_settings, site.default_scan_config)
  }
}

export async function loadIssueDetail(
  pb: PocketBase,
  siteId: string,
  issueId: string
): Promise<AccessibilityIssue> {
  if (issueId.startsWith('rule:')) {
    throw new Error('Use representative issue id for detail')
  }

  const issue = await pb.collection('accessibility_issues').getOne(issueId, {
    expand: 'page'
  }) as unknown as AccessibilityIssue

  const pageRecord = await pb.collection('pages').getOne(issue.page, { fields: 'site,url,title' }) as {
    site?: string
    url?: string
    title?: string
  }

  if (pageRecord.site !== siteId) {
    throw new Error('Issue not found for this site')
  }

  issue.expand = { page: { url: pageRecord.url ?? '', title: pageRecord.title } }
  return issue
}

export function parseIssuesQueryFromParams(query: Record<string, unknown>): A11yIssuesQuery {
  const arr = (key: string) => {
    const raw = query[key]
    if (Array.isArray(raw)) return raw.map(String)
    if (typeof raw === 'string' && raw.trim()) return raw.split(',').map(s => s.trim()).filter(Boolean)
    return undefined
  }

  return {
    page: Number(query.page) || 1,
    perPage: Number(query.perPage) || 20,
    search: String(query.search || '').trim() || undefined,
    wcagLevel: String(query.wcagLevel || '').trim() || undefined,
    wcagLevels: arr('wcagLevels'),
    impacts: arr('impacts'),
    types: arr('types'),
    elements: arr('elements'),
    roles: arr('roles'),
    targetCategories: arr('targetCategories'),
    statuses: arr('statuses')
  }
}
