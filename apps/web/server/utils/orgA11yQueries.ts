import type PocketBase from 'pocketbase'
import type { AccessibilityIssue } from '~/types/sitenook'
import {
  parseIssuesQueryFromParams,
  queryAccessibilityIssues,
  type A11yIssuesQuery
} from './a11yQueries'
import { mapPool } from './mapPool'
import { paginateMerged, resolveOrgSites } from './orgSites'

const ORG_SITE_QUERY_CONCURRENCY = 4

export interface OrgAccessibilityIssueRow extends AccessibilityIssue {
  siteId: string
  siteName: string
}

export async function queryOrgAccessibilityIssues(
  pb: PocketBase,
  orgId: string,
  rawQuery: Record<string, unknown>
) {
  const siteId = typeof rawQuery.siteId === 'string' && rawQuery.siteId.trim()
    ? rawQuery.siteId.trim()
    : undefined
  const query = parseIssuesQueryFromParams(rawQuery)
  const sites = await resolveOrgSites(pb, orgId, { siteId })

  const perSiteQuery: A11yIssuesQuery = {
    ...query,
    page: 1,
    perPage: 500
  }

  const siteResults = await mapPool(sites, ORG_SITE_QUERY_CONCURRENCY, async (site) => {
    const result = await queryAccessibilityIssues(pb, site.siteId, perSiteQuery)
    return { site, result }
  })

  const merged: OrgAccessibilityIssueRow[] = []
  let openUniqueCount = 0
  let openOccurrencesCount = 0
  const pointsToGainByRule: Record<string, number> = {}
  const ruleStats: Record<string, { pages: number, occurrences: number }> = {}

  for (const { site, result } of siteResults) {
    openUniqueCount += result.openUniqueCount
    openOccurrencesCount += result.openOccurrencesCount
    for (const item of result.items) {
      merged.push({ ...item, siteId: site.siteId, siteName: site.name })
    }
    for (const [ruleId, points] of Object.entries(result.pointsToGainByRule)) {
      pointsToGainByRule[ruleId] = (pointsToGainByRule[ruleId] ?? 0) + points
    }
    for (const [ruleId, stats] of Object.entries(result.ruleStats)) {
      const existing = ruleStats[ruleId]
      if (existing) {
        ruleStats[ruleId] = {
          pages: existing.pages + stats.pages,
          occurrences: existing.occurrences + stats.occurrences
        }
      } else {
        ruleStats[ruleId] = { ...stats }
      }
    }
  }

  const impactOrder: Record<string, number> = { critical: 4, serious: 3, moderate: 2, minor: 1 }
  merged.sort((a, b) => (impactOrder[b.impact] || 0) - (impactOrder[a.impact] || 0))

  const page = query.page ?? 1
  const perPage = query.perPage ?? 20
  const paged = paginateMerged(merged, page, perPage)

  return {
    ...paged,
    openUniqueCount,
    openOccurrencesCount,
    occurrencesCount: openOccurrencesCount,
    pointsToGainByRule,
    ruleStats,
    currentA11y: null,
    source: 'org' as const
  }
}
