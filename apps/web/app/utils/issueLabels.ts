import type { AccessibilityIssue } from '~/types/sitenook'
import {
  classifyIssueCategory,
  type IssueTargetCategory
} from '~/utils/siteSettings'

/** Human-readable axe rule id (Title Case). */
export function formatAxeRuleLabel(ruleId: string): string {
  return ruleId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function issueTargetCategory(issue: Pick<AccessibilityIssue, 'rule_id' | 'wcag_sc' | 'element_type'>): IssueTargetCategory {
  return classifyIssueCategory(issue)
}

export function issueTargetCategoryLabel(category: IssueTargetCategory): string {
  switch (category) {
    case 'wcag': return 'WCAG'
    case 'aria': return 'ARIA'
    case 'best_practice': return 'Best practice'
  }
}

export function issueTargetCategoryDescription(category: IssueTargetCategory): string {
  switch (category) {
    case 'wcag':
      return 'Automated axe-core check mapped to a WCAG success criterion and counted toward level scores.'
    case 'aria':
      return 'WAI-ARIA authoring practice check (axe best-practice rule). Counted in the ARIA score pool.'
    case 'best_practice':
      return 'axe-core best-practice check beyond strict WCAG level scoring. Counted in the best-practices score pool.'
  }
}

/** WCAG level shown only for WCAG-category issues (matches score pool logic). */
export function issueWcagLevelDisplay(
  issue: Pick<AccessibilityIssue, 'rule_id' | 'wcag_level' | 'wcag_sc' | 'element_type'>
): string | null {
  if (issueTargetCategory(issue) !== 'wcag') return null
  return issue.wcag_level
}

/** WCAG success criterion shown only for WCAG-category issues. */
export function issueWcagScDisplay(
  issue: Pick<AccessibilityIssue, 'rule_id' | 'wcag_sc' | 'element_type'>
): string | null {
  if (issueTargetCategory(issue) !== 'wcag') return null
  const sc = issue.wcag_sc?.trim()
  return sc || null
}

export function issueWcagConformanceLabel(
  issue: Pick<AccessibilityIssue, 'rule_id' | 'wcag_level' | 'wcag_sc' | 'element_type'>
): string | null {
  const level = issueWcagLevelDisplay(issue)
  if (!level) return null
  const sc = issueWcagScDisplay(issue)
  return sc ? `${level} · ${sc}` : level
}

export function issueNonWcagScopeNote(
  issue: Pick<AccessibilityIssue, 'rule_id' | 'wcag_sc' | 'element_type'>
): string | null {
  const category = issueTargetCategory(issue)
  if (category === 'wcag') return null
  if (category === 'aria') {
    return 'This axe-core check is counted under ARIA practices, not WCAG level scores.'
  }
  return 'This axe-core check is counted under best practices, not WCAG level scores.'
}
