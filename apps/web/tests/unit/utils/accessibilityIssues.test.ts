import { describe, it, expect } from 'vitest'
import type { AccessibilityIssue } from '~/types/sitenook'
import {
  countOpenOccurrences,
  occurrenceCountForRule,
  resolvedAtMs,
  sortOpenByPointsToGain,
  sortResolvedByRecency,
  uniqueByRule,
  uniqueByRuleResolved
} from '~/utils/accessibilityIssues'
import { calculatePointsToGain } from '~/composables/useAccessibility'

function issue(partial: Partial<AccessibilityIssue> & Pick<AccessibilityIssue, 'rule_id' | 'status'>): AccessibilityIssue {
  return {
    id: partial.id ?? '1',
    scan: 's1',
    page: 'p1',
    rule_id: partial.rule_id,
    description: 'Test',
    impact: partial.impact ?? 'minor',
    wcag_level: 'AA',
    type: 'error',
    ...partial
  }
}

describe('accessibilityIssues utils', () => {
  it('resolvedAtMs prefers dismissed_at for dismissed issues', () => {
    const i = issue({
      rule_id: 'a',
      status: 'dismissed',
      dismissed_at: '2025-06-01T12:00:00Z',
      updated: '2025-01-01T00:00:00Z'
    })
    expect(resolvedAtMs(i)).toBe(Date.parse('2025-06-01T12:00:00Z'))
  })

  it('counts open occurrences per rule and site-wide', () => {
    const list = [
      issue({ id: '1', rule_id: 'image-alt', status: 'open' }),
      issue({ id: '2', rule_id: 'image-alt', status: 'open' }),
      issue({ id: '3', rule_id: 'color-contrast', status: 'fixed' })
    ]
    expect(occurrenceCountForRule(list, 'image-alt', ['open'])).toBe(2)
    expect(countOpenOccurrences(list)).toBe(2)
  })

  it('uniqueByRuleResolved keeps latest per rule', () => {
    const list = [
      issue({ id: '1', rule_id: 'a', status: 'fixed', updated: '2025-01-01T00:00:00Z' }),
      issue({ id: '2', rule_id: 'a', status: 'dismissed', dismissed_at: '2025-06-01T12:00:00Z' })
    ]
    expect(uniqueByRuleResolved(list)).toHaveLength(1)
    expect(uniqueByRuleResolved(list)[0]?.status).toBe('dismissed')
  })

  it('sortOpenByPointsToGain orders by points descending', () => {
    const scoring = [
      issue({ id: '1', rule_id: 'high', status: 'open', impact: 'critical' }),
      issue({ id: '2', rule_id: 'low', status: 'open', impact: 'minor' })
    ]
    const rows = uniqueByRule(scoring)
    const sorted = sortOpenByPointsToGain(rows, scoring)
    expect(calculatePointsToGain(scoring, sorted[0]!.rule_id))
      .toBeGreaterThanOrEqual(calculatePointsToGain(scoring, sorted[1]!.rule_id))
  })

  it('sortResolvedByRecency orders newest first', () => {
    const list = [
      issue({ id: '1', rule_id: 'a', status: 'fixed', updated: '2025-01-01T00:00:00Z' }),
      issue({ id: '2', rule_id: 'b', status: 'fixed', updated: '2025-06-01T12:00:00Z' })
    ]
    const sorted = sortResolvedByRecency(uniqueByRuleResolved(list))
    expect(sorted[0]?.rule_id).toBe('b')
  })
})
