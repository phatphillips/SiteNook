import { describe, expect, it } from 'vitest'
import {
  getApplianceEffectiveLimits,
  getLicenceTierLimits,
  isFullSelfHostTier,
  normalizeLicenceTier,
  organizationPlanForLicenceTier
} from '~/utils/licenceTiers'

describe('licenceTiers', () => {
  it('maps community to free limits', () => {
    expect(normalizeLicenceTier('community')).toBe('community')
    expect(organizationPlanForLicenceTier('community')).toBe('free')
    expect(getLicenceTierLimits('community').maxPagesPerScan).toBe(20)
    expect(getLicenceTierLimits('community').maxSites).toBe(1)
  })

  it('maps selfhost to business limits', () => {
    expect(organizationPlanForLicenceTier('selfhost')).toBe('business')
    expect(getLicenceTierLimits('selfhost').maxPagesPerScan).toBe(5_000)
    expect(getLicenceTierLimits('selfhost').policies).toBe(true)
    expect(isFullSelfHostTier('selfhost')).toBe(true)
  })

  it('maps enterprise to enterprise limits', () => {
    expect(organizationPlanForLicenceTier('enterprise')).toBe('enterprise')
    expect(getLicenceTierLimits('enterprise').maxSites).toBeGreaterThan(1000)
  })

  it('treats unknown tiers as community', () => {
    expect(normalizeLicenceTier('nope')).toBe('community')
    expect(normalizeLicenceTier(null)).toBe('community')
  })

  it('uses free caps when licence is invalid', () => {
    const limits = getApplianceEffectiveLimits({
      licenceValid: false,
      tier: 'selfhost'
    })
    expect(limits.maxPagesPerScan).toBe(20)
  })

  it('uses tier limits when licence is valid', () => {
    const limits = getApplianceEffectiveLimits({
      licenceValid: true,
      tier: 'selfhost'
    })
    expect(limits.maxPagesPerScan).toBe(5_000)
  })
})
