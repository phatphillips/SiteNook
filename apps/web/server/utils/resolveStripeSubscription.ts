import type Stripe from 'stripe'
import type { Organization } from '~/types/sitenook'
import { shouldBeginOrganizationClosureFromSubscription, isStripeSubscriptionCancellationPending } from './orgBilling'

/** Load the org's Stripe subscription, falling back to listing by customer id. */
export async function resolveStripeSubscriptionForOrg(
  stripe: Stripe,
  org: Organization
): Promise<Stripe.Subscription | null> {
  const subscriptions = await listStripeSubscriptionsForCustomer(stripe, org)
  return pickOrganizationStripeSubscription(subscriptions, org)
}

export async function listStripeSubscriptionsForCustomer(
  stripe: Stripe,
  org: Organization
): Promise<Stripe.Subscription[]> {
  const custId = org.stripe_customer_id?.trim()
  if (custId) {
    const list = await stripe.subscriptions.list({
      customer: custId,
      status: 'all',
      limit: 20
    })
    if (list.data.length) {
      return list.data
    }
  }

  const subId = org.stripe_subscription_id?.trim()
  if (!subId) {
    return []
  }

  try {
    return [await stripe.subscriptions.retrieve(subId)]
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error)) {
      throw error
    }
    const code = String((error as { code?: string }).code || '')
    if (code !== 'resource_missing') {
      throw error
    }
    return []
  }
}

/** Prefer metadata link, then stored subscription id, then cancel-pending, then newest active. */
export function pickOrganizationStripeSubscription(
  subscriptions: Stripe.Subscription[],
  org: Organization
): Stripe.Subscription | null {
  if (!subscriptions.length) {
    return null
  }

  const orgId = org.id.trim()
  if (orgId) {
    const metadataMatch = subscriptions.find(
      subscription => String(subscription.metadata?.organization_id || '').trim() === orgId
    )
    if (metadataMatch) {
      return metadataMatch
    }
  }

  const subId = org.stripe_subscription_id?.trim()
  if (subId) {
    const linked = subscriptions.find(subscription => subscription.id === subId)
    if (linked) {
      return linked
    }
  }

  const cancelPending = subscriptions.find(
    subscription => isStripeSubscriptionCancellationPending(subscription)
  )
  if (cancelPending) {
    return cancelPending
  }

  const active = subscriptions.find(
    subscription => subscription.status === 'active' || subscription.status === 'trialing'
  )
  if (active) {
    return active
  }

  const sorted = [...subscriptions].sort((a, b) => b.created - a.created)
  return sorted[0] ?? null
}

export function shouldCloseOrgForStripeSubscription(
  subscription: Stripe.Subscription | null
): boolean {
  if (!subscription) {
    return true
  }
  return shouldBeginOrganizationClosureFromSubscription(subscription)
}
