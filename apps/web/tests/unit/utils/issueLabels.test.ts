import { describe, it, expect } from 'vitest'
import type { AccessibilityIssue } from '~/types/sitenook'
import {
  formatAxeRuleLabel,
  issueNonWcagScopeNote,
  issueTargetCategory,
  issueTargetCategoryLabel,
  issueWcagLevelDisplay,
  issueWcagScDisplay,
  issueWcagConformanceLabel
} from '~/utils/issueLabels'

function issue(partial: Partial<AccessibilityIssue>): AccessibilityIssue {
  return {
    id: '1',
    scan: 's1',
    page: 'p1',
    rule_id: 'color-contrast',
    wcag_level: 'AA',
    wcag_sc: '1.4.3',
    impact: 'serious',
    type: 'error',
    description: 'Elements must have sufficient color contrast',
    status: 'open',
    ...partial
  }
}

describe('formatAxeRuleLabel', () => {
  it('title-cases axe rule ids', () => {
    expect(formatAxeRuleLabel('heading-order')).toBe('Heading Order')
  })
})

describe('issueTargetCategory', () => {
  it('classifies WCAG rules', () => {
    expect(issueTargetCategory(issue({ rule_id: 'color-contrast' }))).toBe('wcag')
  })

  it('classifies best-practice rules separately from WCAG scoring', () => {
    expect(issueTargetCategory(issue({
      rule_id: 'heading-order',
      wcag_sc: '1.3.1'
    }))).toBe('best_practice')
  })
})

describe('issueWcagLevelDisplay', () => {
  it('shows level for WCAG-category issues', () => {
    expect(issueWcagLevelDisplay(issue())).toBe('AA')
  })

  it('hides level for best-practice issues even when axe tags include WCAG metadata', () => {
    expect(issueWcagLevelDisplay(issue({
      rule_id: 'heading-order',
      wcag_level: 'AA',
      wcag_sc: '1.3.1'
    }))).toBeNull()
  })
})

describe('issueWcagScDisplay', () => {
  it('shows SC for WCAG-category issues', () => {
    expect(issueWcagScDisplay(issue())).toBe('1.4.3')
  })

  it('hides SC for best-practice issues', () => {
    expect(issueWcagScDisplay(issue({
      rule_id: 'heading-order',
      wcag_sc: '1.3.1'
    }))).toBeNull()
  })
})

describe('issueWcagConformanceLabel', () => {
  it('combines level and SC for WCAG issues', () => {
    expect(issueWcagConformanceLabel(issue())).toBe('AA · 1.4.3')
  })
})

describe('issueTargetCategoryLabel', () => {
  it('returns readable labels', () => {
    expect(issueTargetCategoryLabel('wcag')).toBe('WCAG')
    expect(issueTargetCategoryLabel('best_practice')).toBe('Best practice')
  })
})

describe('issueNonWcagScopeNote', () => {
  it('returns null for WCAG issues', () => {
    expect(issueNonWcagScopeNote(issue())).toBeNull()
  })

  it('explains best-practice scope', () => {
    expect(issueNonWcagScopeNote(issue({ rule_id: 'heading-order' }))).toContain('best practices')
  })
})
