import { describe, expect, it } from 'vitest'
import {
  getApplianceEffectivePlan,
  getLicenceTierLimits,
  normalizeLicenceTier,
  organizationPlanForLicenceTier
} from '../../../src/config/licenceTiers.js'

describe('licenceTiers', () => {
  it('maps community to free and selfhost to business', () => {
    expect(normalizeLicenceTier('community')).toBe('community')
    expect(organizationPlanForLicenceTier('selfhost')).toBe('business')
    expect(getLicenceTierLimits('community').maxPagesPerScan).toBe(20)
    expect(getLicenceTierLimits('selfhost').maxPagesPerScan).toBe(5_000)
  })

  it('falls back to free when licence invalid', () => {
    expect(getApplianceEffectivePlan({ licenceValid: false, tier: 'enterprise' })).toBe('free')
    expect(getApplianceEffectivePlan({ licenceValid: true, tier: 'selfhost' })).toBe('business')
  })
})
