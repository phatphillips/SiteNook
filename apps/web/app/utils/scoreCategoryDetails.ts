import type { AccessibilityIssue } from '~/types/accessiq'
import {
  calculateAccessibilityScores,
  calculatePointsToGain,
  formatPointsToGain
} from '~/composables/useAccessibility'
import {
  buildUrlsByRule,
  countOpenOccurrences,
  sortOpenByPointsToGain,
  uniqueByRule
} from '~/utils/accessibilityIssues'
import type { AccessibilityScoreCategoryId, AccessibilityScoreDetailRow } from '~/utils/siteSettings'
import { classifyIssueCategory } from '~/utils/siteSettings'
import type { ElementTotals } from '~/utils/siteimproveScore'

export const SCORE_DETAILS_DEFAULT_SUMMARY =
  'Per-category progress toward 100% for each WCAG level and practice included in your site target. Hover or click a conformance level to see its score, what it covers, and the fixes that would help most.'

export const SCORE_CATEGORY_DESCRIPTIONS: Record<AccessibilityScoreCategoryId, string> = {
  A: 'Minimum WCAG requirement and the most critical barriers. Level A ensures basic access for users with disabilities.',
  AA: 'Required by most accessibility laws and regulations. Level AA addresses a broader range of barriers beyond Level A.',
  AAA: 'The highest conformance level. Level AAA criteria especially benefit people with cognitive, language, and learning disabilities.',
  aria: 'Correct labelling and roles for assistive technologies. WAI-ARIA practices help custom controls work reliably with screen readers.',
  best_practice: 'Beyond strict WCAG requirements. Best-practice checks catch common accessibility problems recommended for fixing.'
}

export function issueMatchesScoreCategory(
  issue: Pick<AccessibilityIssue, 'rule_id' | 'wcag_level' | 'wcag_sc' | 'element_type'>,
  categoryId: AccessibilityScoreCategoryId
): boolean {
  if (categoryId === 'A' || categoryId === 'AA' || categoryId === 'AAA') {
    return classifyIssueCategory(issue) === 'wcag' && issue.wcag_level === categoryId
  }
  if (categoryId === 'aria') return classifyIssueCategory(issue) === 'aria'
  return classifyIssueCategory(issue) === 'best_practice'
}

export function openIssuesInCategory(
  issues: AccessibilityIssue[],
  categoryId: AccessibilityScoreCategoryId
): AccessibilityIssue[] {
  return issues.filter(i => i.status === 'open' && issueMatchesScoreCategory(i, categoryId))
}

/** Points this category is dragging the overall score down (simulated overall delta). */
export function categoryScoreImpact(
  categoryId: AccessibilityScoreCategoryId,
  scoringIssues: AccessibilityIssue[],
  elementTotals?: ElementTotals | null
): number {
  const scoreable = scoringIssues.filter(i => i.status !== 'fixed')
  if (!scoreable.length) return 0

  const before = calculateAccessibilityScores(scoreable, elementTotals ?? undefined).overall
  const afterIssues = scoreable.filter((issue) => {
    if (issue.status === 'dismissed') return true
    if (issue.status === 'open' && issueMatchesScoreCategory(issue, categoryId)) return false
    return true
  })
  const after = calculateAccessibilityScores(afterIssues, elementTotals ?? undefined).overall
  return Math.max(0, Math.round((after - before) * 10) / 10)
}

export function categoryQuickStats(
  issues: AccessibilityIssue[],
  categoryId: AccessibilityScoreCategoryId
): { failingRules: number, occurrences: number, pagesAffected: number } {
  const open = openIssuesInCategory(issues, categoryId)
  const urlsByRule = buildUrlsByRule(open, ['open'])
  const pageUrls = new Set<string>()
  for (const urls of urlsByRule.values()) {
    for (const url of urls) pageUrls.add(url)
  }
  return {
    failingRules: uniqueByRule(open).length,
    occurrences: countOpenOccurrences(open),
    pagesAffected: pageUrls.size
  }
}

export interface TopFixRule {
  ruleId: string
  ruleName: string
  points: number
}

export function topFixRulesForCategory(
  issues: AccessibilityIssue[],
  scoringIssues: AccessibilityIssue[],
  categoryId: AccessibilityScoreCategoryId,
  elementTotals?: ElementTotals | null,
  limit = 3
): TopFixRule[] {
  const open = openIssuesInCategory(issues, categoryId)
  const unique = uniqueByRule(open)
  const sorted = sortOpenByPointsToGain(unique, scoringIssues)
  return sorted.slice(0, limit).map((issue) => {
    const points = calculatePointsToGain(scoringIssues, issue.rule_id, elementTotals ?? undefined)
    return {
      ruleId: issue.rule_id,
      ruleName: issue.description,
      points
    }
  }).filter(r => r.points > 0)
}

export function issuesLinkForCategory(
  siteId: string,
  categoryId: AccessibilityScoreCategoryId
): string {
  const base = `/sites/${siteId}/accessibility/issues`
  if (categoryId === 'aria') return `${base}?category=aria`
  if (categoryId === 'best_practice') return `${base}?category=best_practice`
  return `${base}?level=${categoryId}`
}

export function viewAllIssuesLabel(row: AccessibilityScoreDetailRow): string {
  if (row.id === 'aria') return 'View all ARIA issues'
  if (row.id === 'best_practice') return 'View all Best practices issues'
  return `View all ${row.label} issues`
}

export function formatScoreImpact(points: number): string {
  if (points <= 0) return '0'
  return formatPointsToGain(points).replace(/^\+/, '')
}

/** Points open issues are dragging the overall score down (if all open issues were fixed). */
export function overallScoreImpact(
  scoringIssues: AccessibilityIssue[],
  elementTotals?: ElementTotals | null
): number {
  const scoreable = scoringIssues.filter(i => i.status !== 'fixed')
  if (!scoreable.length) return 0

  const before = calculateAccessibilityScores(scoreable, elementTotals ?? undefined).overall
  const afterIssues = scoreable.filter(i => i.status !== 'open')
  const after = calculateAccessibilityScores(afterIssues, elementTotals ?? undefined).overall
  return Math.max(0, Math.round((after - before) * 10) / 10)
}

/** Overall score if every open issue in a category were resolved (category at 100%). */
export function potentialOverallScoreForCategory(
  categoryId: AccessibilityScoreCategoryId,
  currentOverall: number,
  scoringIssues: AccessibilityIssue[],
  elementTotals?: ElementTotals | null
): number {
  const impact = categoryScoreImpact(categoryId, scoringIssues, elementTotals)
  if (impact <= 0) return currentOverall
  return Math.min(100, Math.round((currentOverall + impact) * 10) / 10)
}

export function overallQuickStats(
  issues: AccessibilityIssue[]
): { failingRules: number, occurrences: number, pagesAffected: number } {
  const open = issues.filter(i => i.status === 'open')
  const urlsByRule = buildUrlsByRule(open, ['open'])
  const pageUrls = new Set<string>()
  for (const urls of urlsByRule.values()) {
    for (const url of urls) pageUrls.add(url)
  }
  return {
    failingRules: uniqueByRule(open).length,
    occurrences: countOpenOccurrences(open),
    pagesAffected: pageUrls.size
  }
}

export function topFixRulesOverall(
  issues: AccessibilityIssue[],
  scoringIssues: AccessibilityIssue[],
  elementTotals?: ElementTotals | null,
  limit = 2
): TopFixRule[] {
  const open = issues.filter(i => i.status === 'open')
  const unique = uniqueByRule(open)
  const sorted = sortOpenByPointsToGain(unique, scoringIssues)
  return sorted.slice(0, limit).map((issue) => {
    const points = calculatePointsToGain(scoringIssues, issue.rule_id, elementTotals ?? undefined)
    return {
      ruleId: issue.rule_id,
      ruleName: issue.description,
      points
    }
  }).filter(r => r.points > 0)
}
