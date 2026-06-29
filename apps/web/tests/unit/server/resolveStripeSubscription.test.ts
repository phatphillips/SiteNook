import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import {
  pickOrganizationStripeSubscription,
  shouldCloseOrgForStripeSubscription
} from '../../../server/utils/resolveStripeSubscription'
import {
  isStripeSubscriptionCancellationPending,
  shouldBeginOrganizationClosureFromSubscription
} from '../../../server/utils/orgBilling'

function sub(
  overrides: Partial<Stripe.Subscription> & Pick<Stripe.Subscription, 'id' | 'status'>
): Stripe.Subscription {
  return {
    created: 1,
    cancel_at_period_end: false,
    metadata: {},
    ...overrides
  } as Stripe.Subscription
}

describe('resolveStripeSubscription', () => {
  it('prefers metadata organization_id over a stale stored subscription id', () => {
    const subscriptions = [
      sub({
        id: 'sub_old',
        status: 'active',
        cancel_at_period_end: false
      }),
      sub({
        id: 'sub_linked',
        status: 'active',
        cancel_at_period_end: true,
        metadata: { organization_id: 'org1' }
      })
    ]

    const picked = pickOrganizationStripeSubscription(subscriptions, {
      id: 'org1',
      stripe_subscription_id: 'sub_old'
    } as never)

    expect(picked?.id).toBe('sub_linked')
    expect(shouldCloseOrgForStripeSubscription(picked)).toBe(true)
  })

  it('prefers the subscription id stored on the organization when metadata is absent', () => {
    const subscriptions = [
      sub({ id: 'sub_old', status: 'active', cancel_at_period_end: false }),
      sub({ id: 'sub_linked', status: 'active', cancel_at_period_end: true })
    ]

    const picked = pickOrganizationStripeSubscription(subscriptions, {
      id: 'org1',
      stripe_subscription_id: 'sub_linked'
    } as never)

    expect(picked?.id).toBe('sub_linked')
    expect(shouldCloseOrgForStripeSubscription(picked)).toBe(true)
  })

  it('falls back to metadata organization_id when stored subscription id is stale', () => {
    const subscriptions = [
      sub({
        id: 'sub_new',
        status: 'active',
        cancel_at_period_end: true,
        metadata: { organization_id: 'org1' }
      }),
      sub({ id: 'sub_old', status: 'active', cancel_at_period_end: false })
    ]

    const picked = pickOrganizationStripeSubscription(subscriptions, {
      id: 'org1',
      stripe_subscription_id: 'sub_missing'
    } as never)

    expect(picked?.id).toBe('sub_new')
  })

  it('detects cancel-at-period-end as pending cancellation', () => {
    expect(isStripeSubscriptionCancellationPending({
      status: 'active',
      cancel_at_period_end: true
    })).toBe(true)
    expect(shouldBeginOrganizationClosureFromSubscription({
      status: 'active',
      cancel_at_period_end: true
    })).toBe(true)
    expect(shouldCloseOrgForStripeSubscription(sub({
      id: 'sub1',
      status: 'active',
      cancel_at_period_end: true
    }))).toBe(true)
  })

  it('detects flexible billing cancel_at as pending cancellation', () => {
    const snapshot = {
      status: 'active',
      cancel_at_period_end: false,
      cancel_at: Math.floor(Date.now() / 1000) + 86_400,
      canceled_at: Math.floor(Date.now() / 1000),
      cancellation_details: { reason: 'cancellation_requested' }
    }
    expect(isStripeSubscriptionCancellationPending(snapshot)).toBe(true)
    expect(shouldCloseOrgForStripeSubscription(sub({
      id: 'sub_flex',
      status: 'active',
      ...snapshot
    }))).toBe(true)
  })
})
