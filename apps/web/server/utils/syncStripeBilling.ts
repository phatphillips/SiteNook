import type PocketBase from 'pocketbase'
import type Stripe from 'stripe'
import type { H3Event } from 'h3'
import type { Organization } from '~/types/sitenook'
import { closeOrganizationFromStripeSubscription } from './closeOrganization'
import {
  mapStripeSubscriptionStatus,
  isStripeSubscriptionCancellationPending,
  repairMistakenStripeClosure,
  syncOrganizationSubscription
} from './orgBilling'
import { notifyOrgChurnEmails } from './orgClosureNotify'
import {
  listStripeSubscriptionsForCustomer,
  pickOrganizationStripeSubscription,
  shouldCloseOrgForStripeSubscription
} from './resolveStripeSubscription'

export interface SyncStripeBillingResult {
  organization: Organization
  retentionStarted: boolean
  emailsSent: number
  emailError?: string
  stripeStatus?: string
  cancelAtPeriodEnd?: boolean
  stripeSubscriptionId?: string
}

/** Pull latest Stripe subscription state and start churn retention when billing was canceled. */
export async function syncStripeOrganizationBilling(
  pb: PocketBase,
  stripe: Stripe,
  org: Organization,
  event?: H3Event
): Promise<SyncStripeBillingResult> {
  if (org.status === 'closing') {
    org = await repairMistakenStripeClosure(pb, org)
  }

  if (org.status === 'closing') {
    return { organization: org, retentionStarted: false, emailsSent: 0 }
  }

  const subId = org.stripe_subscription_id?.trim()
  const custId = org.stripe_customer_id?.trim()
  if (!subId && !custId) {
    return { organization: org, retentionStarted: false, emailsSent: 0 }
  }

  const subscriptions = await listStripeSubscriptionsForCustomer(stripe, org)
  const subscription = pickOrganizationStripeSubscription(subscriptions, org)

  if (!subscription) {
    const started = await closeOrganizationFromStripeSubscription(pb, org, {
      stripeEvent: 'sync-billing-status',
      stripeStatus: 'deleted'
    }, event)
    const updated = started
      ? await pb.collection('organizations').getOne<Organization>(org.id)
      : org
    return {
      organization: updated,
      retentionStarted: Boolean(started),
      emailsSent: 0,
      stripeStatus: 'deleted'
    }
  }

  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id

  if (subscription.id !== org.stripe_subscription_id?.trim()) {
    await syncOrganizationSubscription(pb, org, {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      subscriptionStatus: mapStripeSubscriptionStatus(subscription.status)
    })
    org = await pb.collection('organizations').getOne<Organization>(org.id)
  }

  const cancelAtPeriodEnd = isStripeSubscriptionCancellationPending(subscription)
  const stripeStatus = subscription.status

  if (shouldCloseOrgForStripeSubscription(subscription)) {
    const started = await closeOrganizationFromStripeSubscription(pb, org, {
      stripeEvent: 'sync-billing-status',
      stripeStatus,
      cancelAtPeriodEnd
    }, event)
    const updated = await pb.collection('organizations').getOne<Organization>(org.id)
    return {
      organization: updated,
      retentionStarted: Boolean(started),
      emailsSent: 0,
      stripeStatus,
      cancelAtPeriodEnd,
      stripeSubscriptionId: subscription.id
    }
  }

  await syncOrganizationSubscription(pb, org, {
    subscriptionStatus: mapStripeSubscriptionStatus(subscription.status),
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId
  })

  const updated = await pb.collection('organizations').getOne<Organization>(org.id)
  return {
    organization: updated,
    retentionStarted: false,
    emailsSent: 0,
    stripeStatus,
    cancelAtPeriodEnd,
    stripeSubscriptionId: subscription.id
  }
}

/** Explicit refresh from billing UI. Returns email delivery details. */
export async function refreshStripeOrganizationBilling(
  pb: PocketBase,
  stripe: Stripe,
  org: Organization,
  event?: H3Event
): Promise<SyncStripeBillingResult> {
  const result = await syncStripeOrganizationBilling(pb, stripe, org, event)
  if (!result.retentionStarted) {
    return result
  }

  const notify = await notifyOrgChurnEmails(event, result.organization.id)
  return {
    ...result,
    emailsSent: notify.sent,
    emailError: notify.error
  }
}
