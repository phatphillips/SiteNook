import { describe, it, expect } from 'vitest'
import { getIssueWhyItMatters, truncatePageUrl } from '~/utils/issueExplanation'
import type { AccessibilityIssue } from '~/types/accessiq'

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

describe('truncatePageUrl', () => {
  it('prefixes with ellipsis when URL is long', () => {
    const long = 'https://example.com/' + 'a'.repeat(80)
    expect(truncatePageUrl(long, 20)).toMatch(/^\.\.\./)
    expect(truncatePageUrl(long, 20).length).toBeLessThanOrEqual(20)
  })
})
