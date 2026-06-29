import { describe, expect, it } from 'vitest'
import {
  assessPlanChange,
  buildPaidPlanChangeAssessments,
  comparePlanTiers
} from '~/utils/planEligibility'

const baseUsage = {
  siteCount: 2,
  teamMemberCount: 2,
  scheduledSiteCount: 0,
  policyCount: 0,
  seoEnabledSiteCount: 0
}

describe('planEligibility', () => {
  it('compares plan tiers', () => {
    expect(comparePlanTiers('team', 'business')).toBe('upgrade')
    expect(comparePlanTiers('business', 'starter')).toBe('downgrade')
    expect(comparePlanTiers('team', 'team')).toBe('same')
    expect(comparePlanTiers('standard', 'team')).toBe('same')
  })

  it('allows upgrades without blockers', () => {
    const result = assessPlanChange('starter', 'team', {
      ...baseUsage,
      scheduledSiteCount: 3,
      seoEnabledSiteCount: 2
    })
    expect(result.eligible).toBe(true)
    expect(result.direction).toBe('upgrade')
    expect(result.blockers).toHaveLength(0)
  })

  it('blocks downgrades when usage exceeds target limits', () => {
    const result = assessPlanChange('team', 'starter', {
      siteCount: 5,
      teamMemberCount: 2,
      scheduledSiteCount: 2,
      policyCount: 0,
      seoEnabledSiteCount: 1
    })
    expect(result.eligible).toBe(false)
    expect(result.blockers.map(blocker => blocker.id)).toEqual([
      'sites',
      'scheduledScans',
      'seoModule'
    ])
  })

  it('builds assessments for each paid tier', () => {
    const assessments = buildPaidPlanChangeAssessments('team', baseUsage)
    expect(assessments).toHaveLength(3)
    expect(assessments.find(item => item.targetPlan === 'team')?.direction).toBe('same')
    expect(assessments.find(item => item.targetPlan === 'business')?.direction).toBe('upgrade')
    expect(assessments.find(item => item.targetPlan === 'starter')?.direction).toBe('downgrade')
  })
})
