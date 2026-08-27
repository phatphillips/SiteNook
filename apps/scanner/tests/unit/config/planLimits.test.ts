import { describe, expect, it } from 'vitest'
import {
  getMaxPagesPerScanForPlan,
  normalizeOrganizationPlan,
  planHasFeature
} from '../../../src/config/planLimits.js'

describe('planLimits', () => {
  it('normalizes legacy standard slug to team', () => {
    expect(normalizeOrganizationPlan('standard')).toBe('team')
  })

  it('caps pages per scan by plan', () => {
    expect(getMaxPagesPerScanForPlan('free')).toBe(20)
    expect(getMaxPagesPerScanForPlan('team')).toBe(1500)
    expect(getMaxPagesPerScanForPlan('business')).toBe(5000)
  })

  it('gates policies to business and enterprise', () => {
    expect(planHasFeature('free', 'policies')).toBe(false)
    expect(planHasFeature('starter', 'policies')).toBe(false)
    expect(planHasFeature('team', 'policies')).toBe(false)
    expect(planHasFeature('business', 'policies')).toBe(true)
    expect(planHasFeature('enterprise', 'policies')).toBe(true)
  })
})
