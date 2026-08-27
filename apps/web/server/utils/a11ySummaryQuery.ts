import type { AccessibilityIssue } from '~/types/sitenook'
import type { A11ySummary, A11ySummaryRuleRow } from '~/utils/a11ySummary'
import { classifyIssueCategory, type SiteSettings } from '~/utils/siteSettings'
import type { A11yIssuesQuery } from './a11yQueries'

export interface A11yRuleStats {
  pages: number
  occurrences: number
}

export interface A11yIssuesSummaryResult {
  items: AccessibilityIssue[]
  total: number
  page: number
  perPage: number
  openUniqueCount: number
  openOccurrencesCount: number
  occurrencesCount: number
  pointsToGainByRule: Record<string, number>
  ruleStats: Record<string, A11yRuleStats>
  currentA11y: A11ySummary
}

export function issueFromSummaryRow(row: A11ySummaryRuleRow): AccessibilityIssue {
  return {
    id: row.representative_issue_id ?? `rule:${row.rule_id}`,
    scan: '',
    page: '',
    rule_id: row.rule_id,
    wcag_level: row.wcag_level as AccessibilityIssue['wcag_level'],
    wcag_version: row.wcag_version,
    impact: row.impact as AccessibilityIssue['impact'],
    type: (row.type as AccessibilityIssue['type']) ?? 'error',
    element_type: row.element_type,
    responsible_role: row.responsible_role,
    description: row.description ?? row.rule_id.replace(/-/g, ' '),
    status: 'open'
  }
}

function filterSummaryRules(
  rows: A11ySummaryRuleRow[],
  query: A11yIssuesQuery,
  _siteSettings: SiteSettings
): A11ySummaryRuleRow[] {
  const statuses = query.statuses?.length ? query.statuses : ['open']

  return rows.filter((row) => {
    if (statuses.includes('open') && row.open_count === 0) return false
    if (statuses.includes('dismissed') && row.dismissed_count === 0 && !statuses.includes('open')) {
      if (!statuses.includes('open')) return false
    }

    const levelFilter = query.wcagLevels?.length
      ? query.wcagLevels
      : (query.wcagLevel && query.wcagLevel !== 'All' ? [query.wcagLevel] : [])
    if (levelFilter.length && !levelFilter.includes(row.wcag_level)) return false

    if (query.targetCategories?.length) {
      const category = classifyIssueCategory({
        rule_id: row.rule_id,
        element_type: row.element_type
      })
      if (!query.targetCategories.includes(category)) return false
    }

    if (query.impacts?.length) {
      const allowed = new Set(query.impacts)
      if (allowed.has('critical')) allowed.add('serious')
      if (!allowed.has(row.impact)) return false
    }

    if (query.types?.length && row.type && !query.types.includes(row.type)) return false
    if (query.elements?.length && row.element_type && !query.elements.includes(row.element_type)) return false
    if (query.roles?.length && row.responsible_role && !query.roles.includes(row.responsible_role)) return false

    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase()
      const hay = `${row.rule_id} ${row.description ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }

    return true
  })
}

export function queryIssuesFromSummary(
  summary: A11ySummary,
  query: A11yIssuesQuery,
  siteSettings: SiteSettings
): A11yIssuesSummaryResult {
  const openRules = summary.by_rule.filter(row => row.open_count > 0)
  const filtered = filterSummaryRules(summary.by_rule, query, siteSettings)

  const impactOrder: Record<string, number> = { critical: 4, serious: 3, moderate: 2, minor: 1 }
  const sorted = filtered.slice().sort((a, b) => {
    const pts = b.points_to_gain - a.points_to_gain
    if (pts !== 0) return pts
    return (impactOrder[b.impact] || 0) - (impactOrder[a.impact] || 0)
  })

  const page = Math.max(1, query.page ?? 1)
  const perPage = Math.min(100, Math.max(1, query.perPage ?? 20))
  const start = (page - 1) * perPage
  const pageRows = sorted.slice(start, start + perPage)

  const ruleStats: Record<string, A11yRuleStats> = {}
  for (const row of filtered) {
    ruleStats[row.rule_id] = {
      pages: row.page_count,
      occurrences: row.open_count
    }
  }

  const pointsToGainByRule: Record<string, number> = {}
  for (const row of summary.by_rule) {
    if (row.points_to_gain > 0) pointsToGainByRule[row.rule_id] = row.points_to_gain
  }

  const filteredOccurrences = filtered.reduce((sum, row) => sum + row.open_count, 0)

  return {
    items: pageRows.map(issueFromSummaryRow),
    total: sorted.length,
    page,
    perPage,
    openUniqueCount: openRules.length,
    openOccurrencesCount: summary.open_issue_count,
    occurrencesCount: filteredOccurrences,
    pointsToGainByRule,
    ruleStats,
    currentA11y: summary
  }
}
