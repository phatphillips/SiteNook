import { describe, expect, it } from 'vitest'
import type { AccessibilityIssue } from '~/types/accessiq'
import {
  categoryScoreImpact,
  issueMatchesScoreCategory,
  issuesLinkForCategory,
  openIssuesInCategory,
  overallQuickStats,
  overallScoreImpact,
  potentialOverallScoreForCategory,
  topFixRulesOverall,
  viewAllIssuesLabel
} from '~/utils/scoreCategoryDetails'

function issue(
  overrides: Partial<AccessibilityIssue> & Pick<AccessibilityIssue, 'rule_id'>
): AccessibilityIssue {
  return {
    id: overrides.id ?? '1',
    scan: overrides.scan ?? 'scan-1',
    page: overrides.page ?? 'page-1',
    wcag_level: overrides.wcag_level ?? 'AA',
    impact: overrides.impact ?? 'serious',
    type: overrides.type ?? 'error',
    description: overrides.description ?? 'Test issue',
    status: overrides.status ?? 'open',
    ...overrides
  }
}

describe('issueMatchesScoreCategory', () => {
  it('matches WCAG level issues', () => {
    const aIssue = issue({ rule_id: 'color-contrast', wcag_level: 'AA', wcag_sc: '1.4.3' })
    expect(issueMatchesScoreCategory(aIssue, 'AA')).toBe(true)
    expect(issueMatchesScoreCategory(aIssue, 'A')).toBe(false)
  })

  it('matches ARIA issues', () => {
    const ariaIssue = issue({ rule_id: 'aria-valid-attr', element_type: 'aria' })
    expect(issueMatchesScoreCategory(ariaIssue, 'aria')).toBe(true)
    expect(issueMatchesScoreCategory(ariaIssue, 'best_practice')).toBe(false)
  })
})

describe('categoryScoreImpact', () => {
  it('returns positive impact when open issues exist in category', () => {
    const issues = [
      issue({ rule_id: 'color-contrast', wcag_level: 'AA', wcag_sc: '1.4.3' })
    ]
    const impact = categoryScoreImpact('AA', issues)
    expect(impact).toBeGreaterThan(0)
  })

  it('returns zero when category has no open issues', () => {
    const issues = [
      issue({ rule_id: 'color-contrast', wcag_level: 'AA', wcag_sc: '1.4.3', status: 'fixed' })
    ]
    expect(categoryScoreImpact('AA', issues)).toBe(0)
  })
})

describe('openIssuesInCategory', () => {
  it('filters to open issues in the requested category', () => {
    const issues = [
      issue({ id: '1', rule_id: 'color-contrast', wcag_level: 'A', wcag_sc: '1.4.1' }),
      issue({ id: '2', rule_id: 'image-alt', wcag_level: 'A', wcag_sc: '1.1.1', status: 'fixed' }),
      issue({ id: '3', rule_id: 'aria-valid-attr', element_type: 'aria' })
    ]
    expect(openIssuesInCategory(issues, 'A')).toHaveLength(1)
    expect(openIssuesInCategory(issues, 'aria')).toHaveLength(1)
  })
})

describe('issuesLinkForCategory', () => {
  it('builds level and category query links', () => {
    expect(issuesLinkForCategory('site-1', 'AA')).toBe('/sites/site-1/accessibility/issues?level=AA')
    expect(issuesLinkForCategory('site-1', 'aria')).toBe('/sites/site-1/accessibility/issues?category=aria')
    expect(issuesLinkForCategory('site-1', 'best_practice')).toBe('/sites/site-1/accessibility/issues?category=best_practice')
  })
})

describe('viewAllIssuesLabel', () => {
  it('uses readable labels', () => {
    expect(viewAllIssuesLabel({ id: 'AA', badge: 'AA', badgeClass: '', label: 'Level AA' }))
      .toBe('View all Level AA issues')
    expect(viewAllIssuesLabel({ id: 'aria', badge: 'ARIA', badgeClass: '', label: 'WAI-ARIA authoring practices' }))
      .toBe('View all ARIA issues')
  })
})

describe('overallScoreImpact', () => {
  it('returns positive impact when open issues exist', () => {
    const issues = [
      issue({ rule_id: 'color-contrast', wcag_level: 'AA', wcag_sc: '1.4.3' })
    ]
    expect(overallScoreImpact(issues)).toBeGreaterThan(0)
  })

  it('returns zero when no open issues remain', () => {
    const issues = [
      issue({ rule_id: 'color-contrast', wcag_level: 'AA', wcag_sc: '1.4.3', status: 'fixed' })
    ]
    expect(overallScoreImpact(issues)).toBe(0)
  })
})

describe('potentialOverallScoreForCategory', () => {
  it('adds category impact to current overall', () => {
    const issues = [
      issue({ rule_id: 'color-contrast', wcag_level: 'AA', wcag_sc: '1.4.3' })
    ]
    const current = 60
    const impact = categoryScoreImpact('AA', issues)
    expect(potentialOverallScoreForCategory('AA', current, issues)).toBe(
      Math.min(100, Math.round((current + impact) * 10) / 10)
    )
  })
})

describe('overallQuickStats', () => {
  it('aggregates open issue stats', () => {
    const issues = [
      issue({ id: '1', rule_id: 'color-contrast', wcag_level: 'AA', wcag_sc: '1.4.3', page: 'p1' }),
      issue({ id: '2', rule_id: 'image-alt', wcag_level: 'A', wcag_sc: '1.1.1', page: 'p2' })
    ]
    const stats = overallQuickStats(issues)
    expect(stats.failingRules).toBe(2)
    expect(stats.occurrences).toBe(2)
  })
})

describe('topFixRulesOverall', () => {
  it('returns top rules with positive points', () => {
    const issues = [
      issue({ id: '1', rule_id: 'color-contrast', wcag_level: 'AA', wcag_sc: '1.4.3' })
    ]
    const fixes = topFixRulesOverall(issues, issues, null, 2)
    expect(fixes.length).toBeGreaterThan(0)
    expect(fixes[0]!.points).toBeGreaterThan(0)
  })
})
