import { describe, expect, it } from 'vitest'
import {
  buildFreePlanStartUrl,
  formatPlanPrice,
  getPlanOffering,
  isOrganizationPlan,
  PAID_PLAN_OFFERINGS,
  PLAN_OFFERINGS,
  resolvePlanCta
} from '~/utils/planPricing'

describe('planPricing', () => {
  it('covers all organization plan values', () => {
    expect(PLAN_OFFERINGS.map(plan => plan.id)).toEqual([
      'free',
      'starter',
      'team',
      'business',
      'enterprise'
    ])
    expect(PAID_PLAN_OFFERINGS.map(plan => plan.id)).toEqual([
      'starter',
      'team',
      'business',
      'enterprise'
    ])
  })

  it('validates organization plan slugs', () => {
    expect(isOrganizationPlan('free')).toBe(true)
    expect(isOrganizationPlan('team')).toBe(true)
    expect(isOrganizationPlan('standard')).toBe(true)
    expect(isOrganizationPlan('enterprise')).toBe(true)
    expect(isOrganizationPlan('pro')).toBe(false)
  })

  it('builds the free-tier start URL with plan query', () => {
    expect(buildFreePlanStartUrl()).toBe('/start?plan=free')
  })

  it('formats monthly and annual prices', () => {
    const team = getPlanOffering('team')!
    expect(formatPlanPrice(team, 'monthly')).toEqual({
      priceLabel: '$99',
      priceDetail: 'per month'
    })
    expect(formatPlanPrice(team, 'annual')).toEqual({
      priceLabel: '$84',
      priceDetail: 'per month, billed annually'
    })
  })

  it('routes free plan to self-service start when enabled', () => {
    expect(resolvePlanCta('free', { selfServiceEnabled: true, supportEmail: 'sales@test.com' })).toEqual({
      kind: 'link',
      href: '/start?plan=free',
      label: 'Get started free'
    })
  })

  it('offers dev bypass for team when enabled locally', () => {
    expect(resolvePlanCta('team', {
      selfServiceEnabled: true,
      supportEmail: 'sales@test.com',
      devBypassEnabled: true
    })).toEqual({
      kind: 'link',
      href: '/start?checkout=dev_bypass&plan=team',
      label: 'Subscribe (dev bypass)'
    })
  })

  it('shows checkout CTA when Stripe is configured', () => {
    const cta = resolvePlanCta('team', {
      selfServiceEnabled: true,
      supportEmail: 'sales@test.com',
      stripeCheckoutConfigured: true
    })
    expect(cta).toEqual({
      kind: 'checkout',
      plan: 'team',
      interval: 'monthly',
      label: 'Subscribe'
    })
  })

  it('uses annual interval when annual checkout is configured', () => {
    const cta = resolvePlanCta('starter', {
      selfServiceEnabled: true,
      supportEmail: 'sales@test.com',
      stripeCheckoutConfigured: true,
      billingInterval: 'annual',
      annualCheckoutConfigured: true
    })
    expect(cta).toMatchObject({
      kind: 'checkout',
      plan: 'starter',
      interval: 'annual'
    })
  })

  it('uses mailto for enterprise', () => {
    const cta = resolvePlanCta('enterprise', { selfServiceEnabled: true, supportEmail: 'sales@test.com' })
    expect(cta.kind).toBe('mailto')
    if (cta.kind === 'mailto') {
      expect(cta.href).toContain('mailto:sales@test.com')
      expect(cta.label).toBe('Contact sales')
    }
  })
})
