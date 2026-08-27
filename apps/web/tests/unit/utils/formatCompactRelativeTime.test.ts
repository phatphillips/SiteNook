import { describe, expect, it } from 'vitest'
import {
  compactPageUrl,
  formatCompactRelativeTime,
  formatScanTimestampLabel
} from '~/utils/formatCompactRelativeTime'

describe('formatCompactRelativeTime', () => {
  const now = Date.parse('2026-08-24T10:00:00.000Z')

  it('returns compact units with ago suffix', () => {
    expect(formatCompactRelativeTime('2026-08-24T09:59:30.000Z', now)).toBe('just now')
    expect(formatCompactRelativeTime('2026-08-24T09:50:00.000Z', now)).toBe('10m ago')
    expect(formatCompactRelativeTime('2026-08-24T07:00:00.000Z', now)).toBe('3h ago')
    expect(formatCompactRelativeTime('2026-08-22T10:00:00.000Z', now)).toBe('2d ago')
  })

  it('returns empty string for invalid timestamps', () => {
    expect(formatCompactRelativeTime('not-a-date', now)).toBe('')
  })
})

describe('formatScanTimestampLabel', () => {
  it('formats a valid timestamp', () => {
    const label = formatScanTimestampLabel('2026-08-21T10:10:01.588Z')
    expect(label.length).toBeGreaterThan(8)
    expect(label).not.toBe('2026-08-21T10:10:01.588Z')
  })
})

describe('compactPageUrl', () => {
  it('shows host plus path without a trailing slash', () => {
    expect(compactPageUrl('https://anything.tas.gov.au/about')).toBe('anything.tas.gov.au/about')
    expect(compactPageUrl('https://anything.tas.gov.au/')).toBe('anything.tas.gov.au')
  })
})
