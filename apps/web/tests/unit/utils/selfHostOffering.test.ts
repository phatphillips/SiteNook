import { describe, expect, it } from 'vitest'
import { SELFHOST_PLAN_MIRROR, organizationPlanForLicenceTier } from '~/utils/licenceTiers'
import { HOSTED_DEPLOYMENT_LABEL, SELF_HOSTED_DEPLOYMENT_LABEL } from '~/utils/planPricing'

describe('self-host offering helpers', () => {
  it('mirrors business for selfhost unlock', () => {
    expect(SELFHOST_PLAN_MIRROR).toBe('business')
    expect(organizationPlanForLicenceTier('selfhost')).toBe('business')
  })

  it('keeps deployment labels for marketing', () => {
    expect(HOSTED_DEPLOYMENT_LABEL).toContain('Hosted')
    expect(SELF_HOSTED_DEPLOYMENT_LABEL).toContain('Self-hosted')
  })
})
