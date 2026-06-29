import { describe, expect, it } from 'vitest'
import { getMaxPagesPerScanForPlan, normalizeOrganizationPlan } from '../../../src/config/planLimits.js'

describe('planLimits', () => {
  it('normalizes legacy standard slug to team', () => {
    expect(normalizeOrganizationPlan('standard')).toBe('team')
  })

  it('caps pages per scan by plan', () => {
    expect(getMaxPagesPerScanForPlan('free')).toBe(100)
    expect(getMaxPagesPerScanForPlan('team')).toBe(1500)
    expect(getMaxPagesPerScanForPlan('business')).toBe(5000)
  })
})
