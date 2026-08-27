import { describe, expect, it } from 'vitest'
import {
  formatA11yDismissReason,
  formatA11yIssueActionSentence,
  getA11yIssueActionMeta,
  reopenIssuePatch,
  type A11yIssueActionEntry
} from '~/utils/a11yIssueHistory'
import { issuePageRowKey, issueRowKey } from '~/utils/issueRowExit'

describe('a11yIssueHistory', () => {
  it('maps action metadata', () => {
    expect(getA11yIssueActionMeta('fixed').label).toBe('Marked fixed')
    expect(getA11yIssueActionMeta('reopened').color).toBe('info')
    expect(getA11yIssueActionMeta('dismissed').icon).toBe('i-lucide-x')
  })

  it('formats dismiss reasons', () => {
    expect(formatA11yDismissReason('wont_fix')).toBe('Won\'t fix')
    expect(formatA11yDismissReason('false_positive')).toBe('False positive')
    expect(formatA11yDismissReason(null)).toBeNull()
  })

  it('builds a reopen patch that clears dismiss fields', () => {
    expect(reopenIssuePatch()).toEqual({
      status: 'open',
      dismissed_at: null,
      dismiss_reason: '',
      dismissed_by: null
    })
  })

  it('formats an action sentence with actor and scope', () => {
    const entry: A11yIssueActionEntry = {
      id: '1',
      organization: 'org',
      site: 'site',
      action: 'dismissed',
      scope: 'rule',
      rule_id: 'color-contrast',
      logged_at: new Date().toISOString(),
      expand: { actor: { id: 'u1', name: 'Luke' } }
    }
    expect(formatA11yIssueActionSentence(entry)).toContain('Luke')
    expect(formatA11yIssueActionSentence(entry)).toContain('dismissed')
  })
})

describe('issueRowExit', () => {
  it('builds stable row keys', () => {
    expect(issueRowKey('color-contrast', 'site1')).toBe('site1:color-contrast')
    expect(issuePageRowKey('color-contrast', 'https://example.com/', 'site1'))
      .toBe('site1:color-contrast::https://example.com/')
  })
})
