import {
  pointsToGainIfAllResolvedForRule,
  resolveElementTotals,
  type ElementTotals,
  type SiteimproveScoreIssue
} from './siteimproveScore.js'
import type { SiteTargetSettings } from './siteTarget.js'
import { normalizePageUrl } from '../search/urlKey.js'

export interface A11ySummaryRuleRow {
  rule_id: string
  wcag_level: string
  impact: string
  open_count: number
  dismissed_count: number
  page_count: number
  points_to_gain: number
  sample_page_urls: string[]
  description?: string
  type?: string
  element_type?: string
  responsible_role?: string
  wcag_version?: string
  representative_issue_id?: string
}

export interface A11ySummary {
  generated_at: string
  page_count: number
  open_issue_count: number
  by_rule: A11ySummaryRuleRow[]
  by_severity: { critical: number, serious: number, moderate: number, minor: number }
  by_level: { A: number, AA: number, AAA: number }
  pages_breakdown?: Array<{ url: string, a_count: number, aa_count: number, aaa_count: number }>
  site_target?: SiteTargetSettings
}

export interface A11ySummaryIssueInput {
  id?: string
  rule_id: string
  wcag_level: string
  impact: string
  status: string
  element_type?: string
  responsible_role?: string
  wcag_version?: string
  wcag_sc?: string
  type?: string
  description?: string
  page_url?: string
}

const SAMPLE_URLS_PER_RULE = 5
const PAGES_BREAKDOWN_MAX = 500

function toScoreIssues(issues: A11ySummaryIssueInput[]): SiteimproveScoreIssue[] {
  return issues
    .filter(i => i.status === 'open' || i.status === 'dismissed')
    .map(i => ({
      rule_id: i.rule_id,
      wcag_level: i.wcag_level as SiteimproveScoreIssue['wcag_level'],
      element_type: i.element_type,
      status: i.status as SiteimproveScoreIssue['status']
    }))
}

export function buildA11ySummary(
  issues: A11ySummaryIssueInput[],
  options: {
    pageCount: number
    elementTotals?: ElementTotals
    includePagesBreakdown?: boolean
    siteTarget?: SiteTargetSettings
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
      const sev = issue.impact as keyof typeof bySeverity
      if (sev in bySeverity) bySeverity[sev] += 1
      const lvl = issue.wcag_level as keyof typeof byLevel
      if (lvl in byLevel) byLevel[lvl] += 1
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

    if (issue.page_url) {
      if (row.sample_urls.size < SAMPLE_URLS_PER_RULE) row.sample_urls.add(issue.page_url)
      if (issue.status === 'open') row.page_keys.add(normalizePageUrl(issue.page_url))
    }
    ruleMap.set(issue.rule_id, row)

    if (options.includePagesBreakdown && issue.status === 'open' && issue.page_url) {
      const key = issue.page_url
      const pageRow = pageBreakdown.get(key) ?? { url: issue.page_url, a_count: 0, aa_count: 0, aaa_count: 0 }
      if (issue.wcag_level === 'A') pageRow.a_count += 1
      if (issue.wcag_level === 'AA') pageRow.aa_count += 1
      if (issue.wcag_level === 'AAA') pageRow.aaa_count += 1
      pageBreakdown.set(key, pageRow)
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
      points_to_gain: pointsToGainIfAllResolvedForRule(scoreIssues, totals, row.rule_id),
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

export function issuesFromPageResults(
  pages: Array<{
    url: string
    issues: Array<{
      id?: string
      rule_id: string
      wcag_level: string
      impact: string
      element_type?: string
      status?: string
      type?: string
      description?: string
      wcag_sc?: string
      wcag_version?: string
    }>
  }>
): A11ySummaryIssueInput[] {
  const result: A11ySummaryIssueInput[] = []
  for (const page of pages) {
    for (const issue of page.issues) {
      result.push({
        id: issue.id,
        rule_id: issue.rule_id,
        wcag_level: issue.wcag_level,
        impact: issue.impact,
        element_type: issue.element_type,
        status: issue.status ?? 'open',
        type: issue.type,
        description: issue.description,
        wcag_sc: issue.wcag_sc,
        wcag_version: issue.wcag_version,
        page_url: page.url
      })
    }
  }
  return result
}
