import { describe, it, expect } from 'vitest'
import { diffScans, fingerprint } from '../../../src/accessibility/diffEngine.js'

const baseIssue = {
  page_url: 'https://example.com/',
  rule_id: 'image-alt',
  css_selector: 'img.hero'
}

describe('diffScans', () => {
  it('returns zero new and fixed when scan results are identical', () => {
    const issues = [{ ...baseIssue, id: 'issue-1' }]
    const result = diffScans(issues, issues)

    expect(result.new_issues).toBe(0)
    expect(result.fixed_issues).toBe(0)
    expect(result.unchanged).toBe(1)
  })

  it('identifies a new issue present only in the current scan', () => {
    const previous = [{ ...baseIssue, id: 'a' }]
    const current = [
      { ...baseIssue, id: 'a' },
      {
        page_url: 'https://example.com/contact',
        rule_id: 'link-name',
        css_selector: 'a.cta',
        id: 'b'
      }
    ]

    const result = diffScans(current, previous)

    expect(result.new_issues).toBe(1)
    expect(result.new_issue_ids).toContain('b')
  })

  it('identifies a resolved issue present only in the previous scan', () => {
    const previous = [
      { ...baseIssue, id: 'a' },
      {
        page_url: 'https://example.com/old',
        rule_id: 'color-contrast',
        css_selector: '.banner',
        id: 'b'
      }
    ]
    const current = [{ ...baseIssue, id: 'a' }]

    const result = diffScans(current, previous)

    expect(result.fixed_issues).toBe(1)
    expect(result.fixed_issue_keys).toContain(
      fingerprint({
        page_url: 'https://example.com/old',
        rule_id: 'color-contrast',
        css_selector: '.banner'
      })
    )
  })

  it('uses IssueFingerprint as the comparison key', () => {
    const previous = [{ ...baseIssue, id: 'old-id' }]
    const current = [{ ...baseIssue, id: 'new-id' }]

    const result = diffScans(current, previous)

    expect(result.new_issues).toBe(0)
    expect(result.fixed_issues).toBe(0)
    expect(result.unchanged).toBe(1)
  })
})
