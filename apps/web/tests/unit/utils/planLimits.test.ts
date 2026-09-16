import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  getPlanLimits,
  normalizeOrganizationPlan,
  planHasFeature,
  formatPlanPrimaryMetric
} from '~/utils/planLimits'

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

  it('returns free limits for unknown plans when commercial is on', () => {
    expect(getPlanLimits('unknown').maxSites).toBe(1)
  })

  it('caps free pages per scan at 20 when commercial is on', () => {
    expect(getPlanLimits('free').maxPagesPerScan).toBe(20)
  })

  it('uses enterprise limits when commercial is off', () => {
    process.env.SITENOOK_COMMERCIAL = '0'
    expect(getPlanLimits('free').maxPagesPerScan).toBe(50_000)
    expect(planHasFeature('free', 'seoModule')).toBe(true)
  })

  it('gates scheduled scans to team and above', () => {
    expect(planHasFeature('free', 'scheduledScans')).toBe(false)
    expect(planHasFeature('starter', 'scheduledScans')).toBe(false)
    expect(planHasFeature('team', 'scheduledScans')).toBe(true)
  })

  it('gates SEO to team and above', () => {
    expect(planHasFeature('starter', 'seoModule')).toBe(false)
    expect(planHasFeature('team', 'seoModule')).toBe(true)
  })

  it('gates policies to business and above', () => {
    expect(planHasFeature('team', 'policies')).toBe(false)
    expect(planHasFeature('business', 'policies')).toBe(true)
  })

  it('gates pdf accessibility to business and above', () => {
    expect(planHasFeature('team', 'pdfAccessibility')).toBe(false)
    expect(planHasFeature('business', 'pdfAccessibility')).toBe(true)
  })

  it('formats primary metric copy', () => {
    expect(formatPlanPrimaryMetric('starter')).toContain('3 sites')
    expect(formatPlanPrimaryMetric('enterprise')).toContain('Custom')
  })
})
