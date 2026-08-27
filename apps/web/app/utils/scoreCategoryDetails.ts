import type { AccessibilityIssue } from '~/types/sitenook'
import {
  calculateAccessibilityScores,
  calculatePointsToGain,
  formatPointsToGain
} from '~/composables/useAccessibility'
import {
  buildUrlsByRule,
  countOpenOccurrences,
  uniqueByRule
} from '~/utils/accessibilityIssues'
import type { AccessibilityScoreCategoryId, AccessibilityScoreDetailRow } from '~/utils/siteSettings'
import { isAriaRule, isBestPracticeRule, type ElementTotals } from '~/utils/siteimproveScore'
import type { A11yCheckStats } from '~/utils/a11yCheckStats'

export const SCORE_DETAILS_DEFAULT_SUMMARY =
  'Per-category progress toward 100% for each WCAG level and practice included in your site target. Hover or click a conformance level to see its score, what it covers, and the fixes that would help most.'

export const SCORE_CATEGORY_DESCRIPTIONS: Record<AccessibilityScoreCategoryId, string> = {
  A: 'Minimum WCAG requirement and the most critical barriers. Level A ensures basic access for users with disabilities.',
  AA: 'Required by most accessibility laws and regulations. Level AA addresses a broader range of barriers beyond Level A.',
  AAA: 'The highest conformance level. Level AAA criteria especially benefit people with cognitive, language, and learning disabilities.',
  aria: 'Correct labelling and roles for assistive technologies. WAI-ARIA practices help custom controls work reliably with screen readers.',
  best_practice: 'Beyond strict WCAG requirements. Best-practice checks catch common accessibility problems recommended for fixing.'
}

/**
 * Match issues to conformance rows using the same pools as category scores
 * (WCAG levels exclude best-practice rules; ARIA = BP aria-* rules).
 */
export function issueMatchesScoreCategory(
  issue: Pick<AccessibilityIssue, 'rule_id' | 'wcag_level' | 'wcag_sc' | 'element_type'>,
  categoryId: AccessibilityScoreCategoryId
): boolean {
  if (categoryId === 'aria') {
    return isAriaRule(issue.rule_id) && isBestPracticeRule(issue.rule_id)
  }
  if (categoryId === 'best_practice') {
    return isBestPracticeRule(issue.rule_id) && !isAriaRule(issue.rule_id)
  }
  // Level A / AA / AAA — non-best-practice issues at that level
  return !isBestPracticeRule(issue.rule_id) && issue.wcag_level === categoryId
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
  elementTotals?: ElementTotals | null,
  checkStats?: A11yCheckStats | null
): number {
  const scoreable = scoringIssues.filter(i => i.status !== 'fixed')
  if (!scoreable.length) return 0

  const before = calculateAccessibilityScores(scoreable, elementTotals ?? undefined, checkStats).overall
  const afterIssues = scoreable.filter((issue) => {
    if (issue.status === 'dismissed') return true
    if (issue.status === 'open' && issueMatchesScoreCategory(issue, categoryId)) return false
    return true
  })
  const after = calculateAccessibilityScores(afterIssues, elementTotals ?? undefined, checkStats).overall
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
  limit = 3,
  options?: { requirePositivePoints?: boolean, checkStats?: A11yCheckStats | null }
): TopFixRule[] {
  // BP / ARIA buckets are small; rounding can yield 0 points while failures still matter.
  const requirePositivePoints = options?.requirePositivePoints ?? false
  const open = openIssuesInCategory(issues, categoryId)
  const unique = uniqueByRule(open)
  const ranked = unique
    .map((issue) => {
      const points = calculatePointsToGain(
        scoringIssues,
        issue.rule_id,
        elementTotals ?? undefined,
        options?.checkStats
      )
      return {
        ruleId: issue.rule_id,
        ruleName: issue.description,
        points
      }
    })
    .sort((a, b) => b.points - a.points)

  const filtered = requirePositivePoints
    ? ranked.filter(r => r.points > 0)
    : ranked

  return filtered.slice(0, limit)
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
  elementTotals?: ElementTotals | null,
  checkStats?: A11yCheckStats | null
): number {
  const scoreable = scoringIssues.filter(i => i.status !== 'fixed')
  if (!scoreable.length) return 0

  const before = calculateAccessibilityScores(scoreable, elementTotals ?? undefined, checkStats).overall
  const afterIssues = scoreable.filter(i => i.status !== 'open')
  const after = calculateAccessibilityScores(afterIssues, elementTotals ?? undefined, checkStats).overall
  return Math.max(0, Math.round((after - before) * 10) / 10)
}

/** Overall score if every open issue in a category were resolved (category at 100%). */
export function potentialOverallScoreForCategory(
  categoryId: AccessibilityScoreCategoryId,
  currentOverall: number,
  scoringIssues: AccessibilityIssue[],
  elementTotals?: ElementTotals | null,
  checkStats?: A11yCheckStats | null
): number {
  const impact = categoryScoreImpact(categoryId, scoringIssues, elementTotals, checkStats)
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
  limit = 2,
  options?: { requirePositivePoints?: boolean, checkStats?: A11yCheckStats | null }
): TopFixRule[] {
  const requirePositivePoints = options?.requirePositivePoints ?? true
  const open = issues.filter(i => i.status === 'open')
  const unique = uniqueByRule(open)
  const ranked = unique
    .map((issue) => {
      const points = calculatePointsToGain(
        scoringIssues,
        issue.rule_id,
        elementTotals ?? undefined,
        options?.checkStats
      )
      return {
        ruleId: issue.rule_id,
        ruleName: issue.description,
        points
      }
    })
    .sort((a, b) => b.points - a.points)

  const filtered = requirePositivePoints
    ? ranked.filter(r => r.points > 0)
    : ranked

  return filtered.slice(0, limit)
}
