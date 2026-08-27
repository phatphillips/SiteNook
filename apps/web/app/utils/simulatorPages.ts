import type { AccessibilityIssue } from '~/types/sitenook'
import { formatIssueSeverity } from '~/utils/issueExplanation'
import { normalizePageUrl, preferPageUrlDisplay } from '~/utils/pageUrl'

const IMPACT_RANK: Record<AccessibilityIssue['impact'], number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1
}

export interface SimulatorPageRow {
  pageId: string
  siteId: string
  url: string
  title: string
  siteName?: string
  issueCount: number
  highestImpact: AccessibilityIssue['impact']
  highestSeverityLabel: string
  issues: AccessibilityIssue[]
}

export function impactRank(impact: AccessibilityIssue['impact']): number {
  return IMPACT_RANK[impact] ?? 0
}

export function highestImpact(
  issues: AccessibilityIssue[]
): AccessibilityIssue['impact'] {
  let best: AccessibilityIssue['impact'] = 'minor'
  let bestRank = 0
  for (const issue of issues) {
    const rank = impactRank(issue.impact)
    if (rank > bestRank) {
      bestRank = rank
      best = issue.impact
    }
  }
  return best
}

export function severityBadgeColor(
  impact: AccessibilityIssue['impact']
): 'error' | 'warning' | 'info' {
  if (impact === 'critical' || impact === 'serious') return 'error'
  if (impact === 'moderate') return 'warning'
  return 'info'
}

/**
 * Group open issues by page id for the Simulator list.
 * Prefers the PocketBase `page` relation id so detail routes can load snapshots.
 */
export function buildSimulatorPageRows(
  issues: AccessibilityIssue[],
  options: {
    siteId?: string
    siteNameById?: Record<string, string>
  } = {}
): SimulatorPageRow[] {
  const map = new Map<string, SimulatorPageRow>()

  for (const issue of issues) {
    if (issue.status === 'dismissed' || issue.status === 'fixed') continue
    const pageId = typeof issue.page === 'string' ? issue.page : ''
    if (!pageId) continue

    const rawUrl = issue.expand?.page?.url || ''
    const resolvedSiteId = options.siteId
      || (issue.expand?.page as { site?: string } | undefined)?.site
      || ''

    const existing = map.get(pageId)
    if (existing) {
      existing.issues.push(issue)
      if (rawUrl) existing.url = preferPageUrlDisplay(existing.url, rawUrl)
      if (!existing.title && issue.expand?.page?.title) {
        existing.title = issue.expand.page.title
      }
      continue
    }

    map.set(pageId, {
      pageId,
      siteId: resolvedSiteId,
      url: rawUrl || normalizePageUrl(rawUrl),
      title: issue.expand?.page?.title || '',
      siteName: options.siteNameById?.[resolvedSiteId],
      issueCount: 0,
      highestImpact: 'minor',
      highestSeverityLabel: 'Minor',
      issues: [issue]
    })
  }

  const rows: SimulatorPageRow[] = []
  for (const row of map.values()) {
    const byRule = new Map<string, AccessibilityIssue>()
    for (const issue of row.issues) {
      if (!byRule.has(issue.rule_id)) byRule.set(issue.rule_id, issue)
    }
    row.issues = [...byRule.values()]
    row.issueCount = row.issues.length
    row.highestImpact = highestImpact(row.issues)
    row.highestSeverityLabel = formatIssueSeverity(row.highestImpact)
    if (!row.siteName && row.siteId && options.siteNameById) {
      row.siteName = options.siteNameById[row.siteId]
    }
    rows.push(row)
  }

  return rows.sort((a, b) => {
    const impactDiff = impactRank(b.highestImpact) - impactRank(a.highestImpact)
    if (impactDiff !== 0) return impactDiff
    return b.issueCount - a.issueCount
  })
}
