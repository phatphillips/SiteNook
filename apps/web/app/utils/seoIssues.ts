import type { SeoIssue } from '~/types/sitenook'
import type { AffectedPageSummary } from '~/utils/affectedPages'
import { dedupePageUrls } from '~/utils/pageUrl'

const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1
}

export interface SeoAffectedPageRow {
  url: string
  title?: string
  currentValue?: string
  expectedValue?: string
  issueId: string
}

export function sortSeoIssues(issues: SeoIssue[]): SeoIssue[] {
  return issues.slice().sort((a, b) =>
    (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0)
  )
}

export function filterSeoIssues(
  issues: SeoIssue[],
  opts: {
    category?: 'technical' | 'content' | 'all'
    subcategory?: string
    statuses?: string[]
    severity?: string[]
  }
): SeoIssue[] {
  return issues.filter((issue) => {
    if (opts.category && opts.category !== 'all' && issue.category !== opts.category) return false
    if (opts.subcategory && issue.subcategory !== opts.subcategory) return false
    if (opts.statuses?.length && !opts.statuses.includes(issue.status)) return false
    if (opts.severity?.length && !opts.severity.includes(issue.severity)) return false
    return true
  })
}

export function countOpenByCategory(issues: SeoIssue[]): { technical: number, content: number } {
  const open = issues.filter(i => i.status === 'open')
  return {
    technical: open.filter(i => i.category === 'technical').length,
    content: open.filter(i => i.category === 'content').length
  }
}

export function topRules(issues: SeoIssue[], limit = 3): string[] {
  const counts = new Map<string, number>()
  for (const issue of issues.filter(i => i.status === 'open')) {
    counts.set(issue.rule_id, (counts.get(issue.rule_id) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([rule]) => rule)
}

/** One representative issue per rule (highest severity first). */
export function uniqueSeoByRule(issueList: SeoIssue[]): SeoIssue[] {
  const sorted = sortSeoIssues(issueList)
  const byRule = new Map<string, SeoIssue>()
  for (const issue of sorted) {
    if (!byRule.has(issue.rule_id)) byRule.set(issue.rule_id, issue)
  }
  return [...byRule.values()]
}

export function buildSeoUrlsByRule(issues: SeoIssue[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const issue of issues) {
    const url = issue.expand?.page?.url
    if (!url) continue
    const list = map.get(issue.rule_id) ?? []
    list.push(url)
    map.set(issue.rule_id, list)
  }
  const result = new Map<string, string[]>()
  for (const [rule, urls] of map) {
    result.set(rule, dedupePageUrls(urls))
  }
  return result
}

export function seoAffectedPagesForRule(issues: SeoIssue[], ruleId: string): SeoAffectedPageRow[] {
  const rows: SeoAffectedPageRow[] = []
  for (const issue of issues) {
    if (issue.rule_id !== ruleId) continue
    const url = issue.expand?.page?.url
    if (!url) continue
    rows.push({
      url,
      title: issue.expand?.page?.title,
      currentValue: issue.current_value || undefined,
      expectedValue: issue.expected_value || undefined,
      issueId: issue.id
    })
  }
  return rows.sort((a, b) => a.url.localeCompare(b.url))
}

export function buildSeoAffectedPagesByRule(issues: SeoIssue[]): Map<string, SeoAffectedPageRow[]> {
  const ruleIds = new Set(issues.map(i => i.rule_id))
  const result = new Map<string, SeoAffectedPageRow[]>()
  for (const ruleId of ruleIds) {
    result.set(ruleId, seoAffectedPagesForRule(issues, ruleId))
  }
  return result
}

export function buildSeoAffectedSummariesByRule(
  issues: SeoIssue[]
): Map<string, AffectedPageSummary[]> {
  const result = new Map<string, AffectedPageSummary[]>()
  for (const [ruleId, rows] of buildSeoAffectedPagesByRule(issues)) {
    result.set(ruleId, rows.map(row => ({
      url: row.url,
      title: row.title,
      occurrences: 1
    })))
  }
  return result
}

export interface SeoSeverityCounts {
  serious: number
  moderate: number
}

export function countSeoIssuesBySeverity(
  issues: SeoIssue[],
  filter: (issue: SeoIssue) => boolean
): SeoSeverityCounts {
  const counts: SeoSeverityCounts = { serious: 0, moderate: 0 }
  for (const issue of issues.filter(i => i.status === 'open' && filter(i))) {
    if (issue.severity === 'critical' || issue.severity === 'serious') {
      counts.serious += 1
    } else if (issue.severity === 'moderate') {
      counts.moderate += 1
    }
  }
  return counts
}
