import type { AccessibilityIssue } from '~/types/accessiq'
import {
  calculateSiteimproveScores,
  formatAccessibilityScore,
  pointsToGainForRule,
  pointsToGainIfAllResolvedForRule,
  resolveElementTotals,
  type ElementTotals,
  type SiteimproveScoreIssue,
  type SiteimproveScores
} from '~/utils/siteimproveScore'

export { formatAccessibilityScore }

function toScoreIssues(issues: AccessibilityIssue[]): SiteimproveScoreIssue[] {
  return issues.map(issue => ({
    rule_id: issue.rule_id,
    wcag_level: issue.wcag_level,
    element_type: issue.element_type,
    status: issue.status
  }))
}

/** Issues that affect scoring (open + dismissed; fixed excluded). */
export function scoreableIssues(issues: AccessibilityIssue[]): AccessibilityIssue[] {
  return issues.filter(issue => issue.status === 'open' || issue.status === 'dismissed')
}

export function calculateAccessibilityScores(
  issues: AccessibilityIssue[],
  elementTotals?: ElementTotals
): SiteimproveScores {
  const scoreIssues = toScoreIssues(scoreableIssues(issues))
  const totals = resolveElementTotals(elementTotals, scoreIssues)
  return calculateSiteimproveScores(scoreIssues, totals)
}

export function calculateAccessibilityScore(issues: AccessibilityIssue[]): number {
  return calculateAccessibilityScores(issues).overall
}

/** @deprecated Use calculateAccessibilityScore */
export function calculateAccessibilityScoreRaw(issues: AccessibilityIssue[]): number {
  return calculateAccessibilityScore(issues)
}

export function calculatePointsToGain(
  issues: AccessibilityIssue[],
  ruleId: string,
  elementTotals?: ElementTotals
): number {
  const scoreIssues = toScoreIssues(scoreableIssues(issues))
  const totals = resolveElementTotals(elementTotals, scoreIssues)
  return pointsToGainIfAllResolvedForRule(scoreIssues, totals, ruleId)
}

export function calculateMarginalPointsToGain(
  issues: AccessibilityIssue[],
  ruleId: string,
  elementTotals?: ElementTotals
): number {
  const scoreIssues = toScoreIssues(scoreableIssues(issues))
  const totals = resolveElementTotals(elementTotals, scoreIssues)
  return pointsToGainForRule(scoreIssues, totals, ruleId)
}

export function buildPointsToGainByRule(
  issues: AccessibilityIssue[],
  elementTotals?: ElementTotals
): Map<string, number> {
  const scoreIssues = toScoreIssues(scoreableIssues(issues))
  const totals = resolveElementTotals(elementTotals, scoreIssues)
  const ruleIds = new Set(scoreIssues.map(i => i.rule_id))
  const map = new Map<string, number>()
  for (const ruleId of ruleIds) {
    map.set(ruleId, pointsToGainIfAllResolvedForRule(scoreIssues, totals, ruleId))
  }
  return map
}

export function formatPointsToGain(points: number): string {
  if (points <= 0) return '—'
  if (points >= 1) {
    const rounded = Math.round(points * 10) / 10
    return Number.isInteger(rounded) ? `+${rounded}` : `+${rounded.toFixed(1)}`
  }
  if (points < 0.005) return '—'
  const text = points.toFixed(2).replace(/\.?0+$/, '')
  return `+${text}`
}
