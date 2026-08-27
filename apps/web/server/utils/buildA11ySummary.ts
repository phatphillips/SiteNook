import type { AccessibilityIssue } from '~/types/sitenook'
import type { A11ySiteTargetSnapshot, A11ySummary, A11ySummaryRuleRow } from '~/utils/a11ySummary'
import { normalizePageUrl } from '~/utils/pageUrl'
import {
  pointsToGainIfAllResolvedForRule,
  resolveElementTotals,
  type ElementTotals,
  type SiteimproveScoreIssue
} from '~/utils/siteimproveScore'
import type { A11yCheckStats } from '~/utils/a11yCheckStats'

const SAMPLE_URLS_PER_RULE = 5
const PAGES_BREAKDOWN_MAX = 500

function toScoreIssues(issues: AccessibilityIssue[]): SiteimproveScoreIssue[] {
  return issues
    .filter(i => i.status === 'open' || i.status === 'dismissed')
    .map(i => ({
      rule_id: i.rule_id,
      wcag_level: i.wcag_level,
      element_type: i.element_type,
      status: i.status
    }))
}

export function buildA11ySummaryFromIssues(
  issues: AccessibilityIssue[],
  options: {
    pageCount: number
    elementTotals?: ElementTotals
    checkStats?: A11yCheckStats | null
    includePagesBreakdown?: boolean
    siteTarget?: A11ySiteTargetSnapshot
  }
): A11ySummary {
  const bySeverity = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  const byLevel = { A: 0, AA: 0, AAA: 0 }
  const ruleMap = new Map<string, {
    rule_id: string
    wcag_level: string
    impact: string
    open_count: number
    dismissed_count: number
    sample_urls: Set<string>
    page_keys: Set<string>
    description?: string
    type?: string
    element_type?: string
    responsible_role?: string
    wcag_version?: string
    representative_issue_id?: string
  }>()
  const pageBreakdown = new Map<string, { url: string, a_count: number, aa_count: number, aaa_count: number }>()

  for (const issue of issues) {
    if (issue.status === 'open') {
      if (issue.impact in bySeverity) {
        bySeverity[issue.impact as keyof typeof bySeverity] += 1
      }
      if (issue.wcag_level in byLevel) {
        byLevel[issue.wcag_level as keyof typeof byLevel] += 1
      }
    }

    if (issue.status !== 'open' && issue.status !== 'dismissed') continue

    const row = ruleMap.get(issue.rule_id) ?? {
      rule_id: issue.rule_id,
      wcag_level: issue.wcag_level,
      impact: issue.impact,
      open_count: 0,
      dismissed_count: 0,
      sample_urls: new Set<string>(),
      page_keys: new Set<string>()
    }

    if (issue.status === 'open') row.open_count += 1
    if (issue.status === 'dismissed') row.dismissed_count += 1

    if (!row.description && issue.description) row.description = issue.description
    if (!row.type && issue.type) row.type = issue.type
    if (!row.element_type && issue.element_type) row.element_type = issue.element_type
    if (!row.responsible_role && issue.responsible_role) row.responsible_role = issue.responsible_role
    if (!row.wcag_version && issue.wcag_version) row.wcag_version = issue.wcag_version
    if (!row.representative_issue_id && issue.status === 'open' && issue.id) {
      row.representative_issue_id = issue.id
    }

    const pageUrl = issue.expand?.page?.url
    if (pageUrl) {
      if (row.sample_urls.size < SAMPLE_URLS_PER_RULE) row.sample_urls.add(pageUrl)
      if (issue.status === 'open') row.page_keys.add(normalizePageUrl(pageUrl))
    }
    ruleMap.set(issue.rule_id, row)

    if (options.includePagesBreakdown && issue.status === 'open' && pageUrl) {
      const pageRow = pageBreakdown.get(pageUrl) ?? { url: pageUrl, a_count: 0, aa_count: 0, aaa_count: 0 }
      if (issue.wcag_level === 'A') pageRow.a_count += 1
      if (issue.wcag_level === 'AA') pageRow.aa_count += 1
      if (issue.wcag_level === 'AAA') pageRow.aaa_count += 1
      pageBreakdown.set(pageUrl, pageRow)
    }
  }

  const scoreIssues = toScoreIssues(issues)
  const totals = resolveElementTotals(options.elementTotals, scoreIssues)

  const by_rule: A11ySummaryRuleRow[] = [...ruleMap.values()]
    .map(row => ({
      rule_id: row.rule_id,
      wcag_level: row.wcag_level,
      impact: row.impact,
      open_count: row.open_count,
      dismissed_count: row.dismissed_count,
      page_count: row.page_keys.size,
      points_to_gain: pointsToGainIfAllResolvedForRule(
        scoreIssues,
        totals,
        row.rule_id,
        options.checkStats
      ),
      sample_page_urls: [...row.sample_urls],
      description: row.description,
      type: row.type,
      element_type: row.element_type,
      responsible_role: row.responsible_role,
      wcag_version: row.wcag_version,
      representative_issue_id: row.representative_issue_id
    }))
    .sort((a, b) => b.points_to_gain - a.points_to_gain)

  const summary: A11ySummary = {
    generated_at: new Date().toISOString(),
    page_count: options.pageCount,
    open_issue_count: issues.filter(i => i.status === 'open').length,
    by_rule,
    by_severity: bySeverity,
    by_level: byLevel
  }

  if (options.siteTarget) {
    summary.site_target = options.siteTarget
  }

  if (options.includePagesBreakdown && pageBreakdown.size) {
    summary.pages_breakdown = [...pageBreakdown.values()]
      .sort((a, b) => a.url.localeCompare(b.url))
      .slice(0, PAGES_BREAKDOWN_MAX)
  }

  return summary
}
