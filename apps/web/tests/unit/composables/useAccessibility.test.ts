import { describe, it, expect } from 'vitest'
import {
  calculateAccessibilityScore,
  calculatePointsToGain,
  formatPointsToGain,
  pickMostRecentScan
} from '~/composables/useAccessibility'
import type { AccessibilityIssue, Scan } from '~/types/accessiq'

function issue(partial: Partial<AccessibilityIssue> & Pick<AccessibilityIssue, 'rule_id' | 'impact'>): AccessibilityIssue {
  return {
    id: partial.id ?? '1',
    scan: 's1',
    page: 'p1',
    rule_id: partial.rule_id,
    description: partial.description ?? 'Test',
    impact: partial.impact,
    wcag_level: partial.wcag_level ?? 'AA',
    type: 'error',
    status: 'open',
    ...partial
  }
}

describe('pickMostRecentScan', () => {
  it('prefers running scan', () => {
    const scans: Scan[] = [
      {
        id: '1',
        site: 's1',
        status: 'complete',
        scan_type: 'full',
        pages_crawled: 5,
        completed_at: '2025-06-01T12:00:00Z'
      },
      {
        id: '2',
        site: 's1',
        status: 'running',
        scan_type: 'full',
        pages_crawled: 1,
        started_at: '2025-06-02T10:00:00Z'
      }
    ]
    expect(pickMostRecentScan(scans)?.id).toBe('2')
  })

  it('returns most recently completed when none running', () => {
    const scans: Scan[] = [
      {
        id: '1',
        site: 's1',
        status: 'complete',
        scan_type: 'full',
        pages_crawled: 5,
        completed_at: '2025-01-01T12:00:00Z'
      },
      {
        id: '2',
        site: 's1',
        status: 'complete',
        scan_type: 'full',
        pages_crawled: 10,
        completed_at: '2025-06-01T12:00:00Z'
      }
    ]
    expect(pickMostRecentScan(scans)?.id).toBe('2')
  })
})

describe('calculateAccessibilityScore', () => {
  it('returns 100 with no open issues', () => {
    expect(calculateAccessibilityScore([])).toBe(100)
  })

  it('lowers score when open issues exist', () => {
    const open = [
      issue({ rule_id: 'color-contrast', impact: 'serious', wcag_level: 'AA' }),
      issue({ rule_id: 'color-contrast', impact: 'serious', wcag_level: 'AA' })
    ]
    expect(calculateAccessibilityScore(open)).toBeLessThan(100)
  })
})

describe('calculatePointsToGain', () => {
  it('returns zero when no open issues', () => {
    expect(calculatePointsToGain([], 'color-contrast')).toBe(0)
  })

  it('awards more points to gain for rules with more occurrences', () => {
    const open = [
      issue({ id: '1', rule_id: 'color-contrast', impact: 'critical', wcag_level: 'AA' }),
      issue({ id: '2', rule_id: 'color-contrast', impact: 'critical', wcag_level: 'AA' }),
      issue({ id: '3', rule_id: 'image-alt', impact: 'minor', wcag_level: 'A', element_type: 'image' })
    ]
    const contrastGain = calculatePointsToGain(open, 'color-contrast')
    const altGain = calculatePointsToGain(open, 'image-alt')
    expect(contrastGain).toBeGreaterThan(0)
    expect(contrastGain).toBeGreaterThanOrEqual(altGain)
  })

  it('returns smaller gain for a low-impact rule than a critical rule', () => {
    const open = [
      issue({ rule_id: 'minor-rule', impact: 'minor', wcag_level: 'A' }),
      issue({ rule_id: 'critical-rule', impact: 'critical', wcag_level: 'A' }),
      issue({ id: 'c2', rule_id: 'critical-rule', impact: 'critical', wcag_level: 'A' })
    ]
    const minorGain = calculatePointsToGain(open, 'minor-rule')
    const criticalGain = calculatePointsToGain(open, 'critical-rule')
    expect(criticalGain).toBeGreaterThan(0)
    expect(minorGain).toBeLessThanOrEqual(criticalGain)
  })

  it('returns zero for unknown rule', () => {
    const open = [issue({ rule_id: 'a', impact: 'minor' })]
    expect(calculatePointsToGain(open, 'missing-rule')).toBe(0)
  })
})

describe('formatPointsToGain', () => {
  it('formats whole and fractional gains', () => {
    expect(formatPointsToGain(0)).toBe('—')
    expect(formatPointsToGain(16)).toBe('+16')
    expect(formatPointsToGain(0.45)).toBe('+0.45')
    expect(formatPointsToGain(0.8)).toBe('+0.8')
  })
})
