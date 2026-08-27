import { describe, it, expect } from 'vitest'
import {
  getIssueFixSteps,
  getIssueWhyItMatters,
  getWcagUnderstandingUrl,
  splitFixSuggestion,
  truncatePageUrl
} from '~/utils/issueExplanation'
import type { AccessibilityIssue } from '~/types/sitenook'

function issue(partial: Partial<AccessibilityIssue>): AccessibilityIssue {
  return {
    id: '1',
    scan: 's1',
    page: 'p1',
    rule_id: 'heading-order',
    wcag_level: 'AA',
    impact: 'moderate',
    type: 'error',
    description: 'Heading levels should only increase by one',
    status: 'open',
    ...partial
  }
}

describe('getIssueWhyItMatters', () => {
  it('returns rule-specific copy without repeating the title', () => {
    const text = getIssueWhyItMatters(issue({ rule_id: 'heading-order' }))
    expect(text).toContain('screen reader')
    expect(text).not.toBe('Heading levels should only increase by one')
  })

  it('falls back to generic message for unknown rules', () => {
    const text = getIssueWhyItMatters(issue({ rule_id: 'unknown-rule-xyz' }))
    expect(text).toContain('assistive technology')
  })
})

describe('splitFixSuggestion', () => {
  it('splits pipe-joined axe messages and drops empties', () => {
    expect(splitFixSuggestion('Fix A | Fix B |  ')).toEqual(['Fix A', 'Fix B'])
  })

  it('returns empty for placeholder or missing', () => {
    expect(splitFixSuggestion('See help URL for guidance.')).toEqual([])
    expect(splitFixSuggestion(null)).toEqual([])
    expect(splitFixSuggestion(undefined)).toEqual([])
  })

  it('filters parts redundant with the issue title', () => {
    expect(
      splitFixSuggestion('Heading levels should only increase by one | Use sequential levels', {
        description: 'Heading levels should only increase by one',
        ruleId: 'heading-order'
      })
    ).toEqual(['Use sequential levels'])
  })
})

describe('getIssueFixSteps', () => {
  it('prefers curated steps for known rules', () => {
    const steps = getIssueFixSteps(issue({ rule_id: 'image-alt', fix_suggestion: 'Scanner text' }))
    expect(steps.length).toBeGreaterThan(1)
    expect(steps[0]).toContain('alt')
  })

  it('falls back to split scanner suggestion for unknown rules', () => {
    const steps = getIssueFixSteps(
      issue({
        rule_id: 'unknown-rule-xyz',
        fix_suggestion: 'Do this | Then that'
      })
    )
    expect(steps).toEqual(['Do this', 'Then that'])
  })
})

describe('getWcagUnderstandingUrl', () => {
  it('builds a 2.2 Understanding URL by default', () => {
    expect(getWcagUnderstandingUrl({ wcag_sc: '1.3.1' })).toBe(
      'https://www.w3.org/WAI/WCAG22/Understanding/131'
    )
  })

  it('respects wcag_version when valid', () => {
    expect(getWcagUnderstandingUrl({ wcag_sc: '1.4.3', wcag_version: '2.1' })).toBe(
      'https://www.w3.org/WAI/WCAG21/Understanding/143'
    )
  })

  it('falls back to 2.2 for invalid versions', () => {
    expect(getWcagUnderstandingUrl({ wcag_sc: '2.4.1', wcag_version: '3.0' })).toBe(
      'https://www.w3.org/WAI/WCAG22/Understanding/241'
    )
  })

  it('returns empty when sc is missing', () => {
    expect(getWcagUnderstandingUrl({})).toBe('')
  })
})

describe('truncatePageUrl', () => {
  it('prefixes with ellipsis when URL is long', () => {
    const long = 'https://example.com/' + 'a'.repeat(80)
    expect(truncatePageUrl(long, 20)).toMatch(/^\.\.\./)
    expect(truncatePageUrl(long, 20).length).toBeLessThanOrEqual(20)
  })
})
