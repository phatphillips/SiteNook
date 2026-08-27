import { describe, expect, it } from 'vitest'
import { buildCheckoutSessionParams, buildStandardCheckoutSessionParams } from '../../../server/utils/stripeCheckoutSession'

describe('stripeCheckoutSession', () => {
  it('builds checkout params for a paid plan', () => {
    expect(buildCheckoutSessionParams({
      plan: 'starter',
      priceId: 'price_test',
      successUrl: 'https://sitenook.com/start?checkout={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://sitenook.com/pricing?checkout=cancelled',
      interval: 'annual'
    })).toEqual({
      mode: 'subscription',
      line_items: [{ price: 'price_test', quantity: 1 }],
      success_url: 'https://sitenook.com/start?checkout={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://sitenook.com/pricing?checkout=cancelled',
      metadata: { sitenook_plan: 'starter', sitenook_interval: 'annual' },
      subscription_data: { metadata: { sitenook_plan: 'starter', sitenook_interval: 'annual' } }
    })
  })

  it('builds legacy team checkout params', () => {
    expect(buildStandardCheckoutSessionParams({
      standardPriceId: 'price_test',
      successUrl: 'https://sitenook.com/start?checkout={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://sitenook.com/pricing?checkout=cancelled'
    })).toEqual({
      mode: 'subscription',
      line_items: [{ price: 'price_test', quantity: 1 }],
      success_url: 'https://sitenook.com/start?checkout={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://sitenook.com/pricing?checkout=cancelled',
      metadata: { sitenook_plan: 'team', sitenook_interval: 'monthly' },
      subscription_data: { metadata: { sitenook_plan: 'team', sitenook_interval: 'monthly' } }
    })
  })

  it('includes organization_id for in-dashboard upgrades', () => {
    const params = buildCheckoutSessionParams({
      plan: 'team',
      priceId: 'price_test',
      successUrl: 'https://tenant.sitenook.com/settings/billing?checkout=success',
      cancelUrl: 'https://tenant.sitenook.com/settings/billing?checkout=cancelled',
      organizationId: 'org_upgrade'
    })

    expect(params.metadata).toEqual({
      sitenook_plan: 'team',
      sitenook_interval: 'monthly',
      organization_id: 'org_upgrade'
    })
    expect(params.subscription_data?.metadata).toEqual({
      sitenook_plan: 'team',
      sitenook_interval: 'monthly',
      organization_id: 'org_upgrade'
    })
  })
})
