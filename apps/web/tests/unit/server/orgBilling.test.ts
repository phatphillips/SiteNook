import { describe, expect, it, vi } from 'vitest'
import type { Organization } from '~/types/sitenook'
import {
  canUpgradeOrganizationToStandard,
  computePurgeScheduledAt,
  describeUpgradeIneligibility,
  hasActiveStripeSubscription,
  mapStripeSubscriptionStatus,
  ORG_PURGE_GRACE_DAYS,
  isOrganizationClosing,
  shouldUseCheckoutForPlanChange
} from '../../../server/utils/orgBilling'

function mockOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org_test',
    name: 'Test Org',
    subdomain: 'test',
    plan: 'free',
    status: 'active',
    created: '',
    updated: '',
    ...overrides
  }
}

describe('orgBilling', () => {
  it('computes purge date 30 days after closure', () => {
    const closedAt = new Date('2026-06-15T12:00:00.000Z')
    const purgeAt = computePurgeScheduledAt(closedAt)
    expect(ORG_PURGE_GRACE_DAYS).toBe(30)
    expect(purgeAt.toISOString()).toBe('2026-07-15T12:00:00.000Z')
  })

  it('maps Stripe subscription statuses', () => {
    expect(mapStripeSubscriptionStatus('active')).toBe('active')
    expect(mapStripeSubscriptionStatus('past_due')).toBe('past_due')
    expect(mapStripeSubscriptionStatus('canceled')).toBe('canceled')
    expect(mapStripeSubscriptionStatus('unpaid')).toBe('canceled')
    expect(mapStripeSubscriptionStatus('trialing')).toBe('trialing')
    expect(mapStripeSubscriptionStatus('incomplete')).toBe('none')
  })

  it('detects pending Stripe cancellation and closure triggers', async () => {
    const {
      isStripeSubscriptionCancellationPending,
      shouldBeginOrganizationClosureFromSubscription
    } = await import('../../../server/utils/orgBilling')

    expect(isStripeSubscriptionCancellationPending({
      status: 'active',
      cancel_at_period_end: true
    })).toBe(true)
    expect(isStripeSubscriptionCancellationPending({
      status: 'active',
      cancel_at_period_end: false
    })).toBe(false)

    expect(isStripeSubscriptionCancellationPending({
      status: 'active',
      cancel_at_period_end: false,
      cancel_at: Math.floor(Date.now() / 1000) + 86_400,
      canceled_at: Math.floor(Date.now() / 1000),
      cancellation_details: { reason: 'cancellation_requested' }
    })).toBe(true)

    expect(shouldBeginOrganizationClosureFromSubscription({
      status: 'active',
      cancel_at_period_end: true
    })).toBe(true)
    expect(shouldBeginOrganizationClosureFromSubscription({
      status: 'active',
      cancel_at_period_end: false,
      canceled_at: 1781586866,
      cancel_at: 1784165646
    })).toBe(true)
    expect(shouldBeginOrganizationClosureFromSubscription({
      status: 'canceled',
      cancel_at_period_end: false
    })).toBe(true)
    expect(shouldBeginOrganizationClosureFromSubscription({
      status: 'active',
      cancel_at_period_end: false
    })).toBe(false)
  })

  it('detects closing organizations', () => {
    expect(isOrganizationClosing({ status: 'closing' })).toBe(true)
    expect(isOrganizationClosing({ status: 'active' })).toBe(false)
    expect(isOrganizationClosing(null)).toBe(false)
  })

  it('detects active Stripe subscriptions', () => {
    expect(hasActiveStripeSubscription({ subscription_status: 'active' })).toBe(true)
    expect(hasActiveStripeSubscription({ subscription_status: 'trialing' })).toBe(true)
    expect(hasActiveStripeSubscription({ subscription_status: 'past_due' })).toBe(true)
    expect(hasActiveStripeSubscription({ subscription_status: 'canceled' })).toBe(false)
    expect(hasActiveStripeSubscription({ subscription_status: 'none' })).toBe(false)
  })

  it('uses checkout when there is no active subscription', () => {
    expect(shouldUseCheckoutForPlanChange(mockOrg())).toBe(true)
    expect(shouldUseCheckoutForPlanChange(mockOrg({ plan: 'team' }))).toBe(true)
    expect(shouldUseCheckoutForPlanChange(mockOrg({ stripe_customer_id: 'cus_test' }))).toBe(true)
    expect(shouldUseCheckoutForPlanChange(mockOrg({
      plan: 'team',
      stripe_subscription_id: 'sub_test',
      subscription_status: 'active'
    }))).toBe(false)
    expect(shouldUseCheckoutForPlanChange(mockOrg({ status: 'closing' }))).toBe(false)
  })

  it('allows upgrade checkout for orgs without an active subscription', () => {
    expect(canUpgradeOrganizationToStandard(mockOrg())).toBe(true)
    expect(canUpgradeOrganizationToStandard(mockOrg({ plan: 'team' }))).toBe(true)
    expect(canUpgradeOrganizationToStandard(mockOrg({
      plan: 'team',
      stripe_subscription_id: 'sub_test',
      subscription_status: 'active'
    }))).toBe(false)
    expect(canUpgradeOrganizationToStandard(mockOrg({ status: 'closing' }))).toBe(false)
  })

  it('describes upgrade ineligibility', () => {
    expect(describeUpgradeIneligibility(mockOrg({ status: 'closing' })))
      .toMatch(/closing/)
    expect(describeUpgradeIneligibility(mockOrg({ subscription_status: 'active' })))
      .toMatch(/active subscription/)
  })

  it('omits empty actor from activity log payload', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'log1' })
    const pb = {
      collection: (name: string) => {
        if (name === 'team_activity_log') {
          return { create }
        }
        throw new Error(`unexpected ${name}`)
      }
    } as unknown as import('pocketbase').default

    const { writeOrgActivityLog } = await import('../../../server/utils/orgBilling')
    await writeOrgActivityLog(pb, {
      organizationId: 'org1',
      action: 'subscription_updated',
      details: { source: 'test' }
    })

    expect(create).toHaveBeenCalledWith({
      organization: 'org1',
      action: 'subscription_updated',
      details: { source: 'test' }
    })
  })
})
