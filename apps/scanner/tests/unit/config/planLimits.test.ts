import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  getMaxPagesPerScanForPlan,
  normalizeOrganizationPlan,
  planHasFeature
} from '../../../src/config/planLimits.js'

describe('planLimits', () => {
  const prevCommercial = process.env.SITENOOK_COMMERCIAL

  beforeEach(() => {
    process.env.SITENOOK_COMMERCIAL = '1'
  })

  afterEach(() => {
    if (prevCommercial === undefined) delete process.env.SITENOOK_COMMERCIAL
    else process.env.SITENOOK_COMMERCIAL = prevCommercial
  })

  it('normalizes legacy standard slug to team', () => {
    expect(normalizeOrganizationPlan('standard')).toBe('team')
  })

  it('caps pages per scan by plan when commercial is on', () => {
    expect(getMaxPagesPerScanForPlan('free')).toBe(20)
    expect(getMaxPagesPerScanForPlan('team')).toBe(1500)
    expect(getMaxPagesPerScanForPlan('business')).toBe(5000)
  })

  it('uses enterprise limits when commercial is off', () => {
    process.env.SITENOOK_COMMERCIAL = '0'
    expect(getMaxPagesPerScanForPlan('free')).toBe(50_000)
    expect(planHasFeature('free', 'policies')).toBe(true)
  })

  it('gates policies to business and enterprise', () => {
    expect(planHasFeature('free', 'policies')).toBe(false)
    expect(planHasFeature('starter', 'policies')).toBe(false)
    expect(planHasFeature('team', 'policies')).toBe(false)
    expect(planHasFeature('business', 'policies')).toBe(true)
    expect(planHasFeature('enterprise', 'policies')).toBe(true)
  })
})
