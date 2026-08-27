import { describe, expect, it } from 'vitest'
import { daysRemainingUntil, parseTeamTrialFlag } from '~/utils/planPricing'

describe('planPricing trial helpers', () => {
  it('parses team trial flags', () => {
    expect(parseTeamTrialFlag('1')).toBe(true)
    expect(parseTeamTrialFlag('true')).toBe(true)
    expect(parseTeamTrialFlag(1)).toBe(true)
    expect(parseTeamTrialFlag('0')).toBe(false)
    expect(parseTeamTrialFlag(undefined)).toBe(false)
  })

  it('computes days remaining', () => {
    const now = new Date('2026-01-01T12:00:00.000Z')
    expect(daysRemainingUntil('2026-01-03T00:00:00.000Z', now)).toBe(2)
    expect(daysRemainingUntil('2025-12-01T00:00:00.000Z', now)).toBe(0)
  })
})
