import type { AccessibilityIssue } from '~/types/accessiq'
import { calculatePointsToGain } from '~/utils/a11yScoring'
import { dedupePageUrls } from '~/utils/pageUrl'

export function countOpenOccurrences(issueList: AccessibilityIssue[]): number {
  return issueList.filter(i => i.status === 'open').length
}

export function occurrenceCountForRule(
  issueList: AccessibilityIssue[],
  ruleId: string,
  statuses?: Array<AccessibilityIssue['status']>
): number {
  const allowed = statuses ? new Set(statuses) : null
  return issueList.filter((issue) => {
    if (issue.rule_id !== ruleId) return false
    if (allowed && !allowed.has(issue.status)) return false
    return true
  }).length
}

export function uniqueByRule(issueList: AccessibilityIssue[]): AccessibilityIssue[] {
  const byRule = new Map<string, AccessibilityIssue>()
  for (const issue of issueList) {
    if (!byRule.has(issue.rule_id)) byRule.set(issue.rule_id, issue)
  }
  return [...byRule.values()]
}

/** One row per rule; keeps the most recently resolved instance. */
export function uniqueByRuleResolved(issueList: AccessibilityIssue[]): AccessibilityIssue[] {
  const byRule = new Map<string, AccessibilityIssue>()
  for (const issue of issueList) {
    const existing = byRule.get(issue.rule_id)
    if (!existing || resolvedAtMs(issue) > resolvedAtMs(existing)) {
      byRule.set(issue.rule_id, issue)
    }
  }
  return [...byRule.values()]
}

export function resolvedAtMs(issue: AccessibilityIssue): number {
  const raw = issue.status === 'dismissed'
    ? (issue.dismissed_at ?? issue.updated)
    : issue.updated
  if (!raw) return 0
  const ms = Date.parse(String(raw))
  return Number.isFinite(ms) ? ms : 0
}

export function buildUrlsByRule(
  issues: AccessibilityIssue[],
  statuses?: Array<AccessibilityIssue['status']>
): Map<string, string[]> {
  const allowed = statuses ? new Set(statuses) : null
  const map = new Map<string, string[]>()
  for (const issue of issues) {
    if (allowed && !allowed.has(issue.status)) continue
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

export function sortOpenByPointsToGain(
  issueList: AccessibilityIssue[],
  scoringIssues: AccessibilityIssue[]
): AccessibilityIssue[] {
  return [...issueList].sort((a, b) =>
    calculatePointsToGain(scoringIssues, b.rule_id)
    - calculatePointsToGain(scoringIssues, a.rule_id)
  )
}

export function sortResolvedByRecency(issueList: AccessibilityIssue[]): AccessibilityIssue[] {
  return [...issueList].sort((a, b) => resolvedAtMs(b) - resolvedAtMs(a))
}
