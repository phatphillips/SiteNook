import type PocketBase from 'pocketbase'
import { ClientResponseError } from 'pocketbase'
import type { Organization, OrganizationPlan, SubscriptionStatus } from '~/types/sitenook'
import { pbSelect } from '~/utils/pbFilter'

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
}

export const ORG_PURGE_GRACE_DAYS = 30

export function computePurgeScheduledAt(closedAt: Date = new Date()): Date {
  const purgeAt = new Date(closedAt)
  purgeAt.setUTCDate(purgeAt.getUTCDate() + ORG_PURGE_GRACE_DAYS)
  return purgeAt
}

export function mapStripeSubscriptionStatus(status: string | null | undefined): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'unpaid':
      return 'canceled'
    case 'trialing':
      return 'trialing'
    default:
      return 'none'
  }
}

export interface StripeSubscriptionCancellationSnapshot {
  status: string
  cancel_at_period_end?: boolean | null
  cancel_at?: number | null
  canceled_at?: number | null
  cancellation_details?: { reason?: string | null } | null
}

const PENDING_CANCEL_STATUSES = new Set(['active', 'trialing'])

/**
 * Stripe may schedule cancellation via cancel_at_period_end (classic) or cancel_at /
 * canceled_at (flexible billing / Customer Portal) while status stays active.
 */
export function isStripeSubscriptionCancellationPending(
  subscription: StripeSubscriptionCancellationSnapshot
): boolean {
  if (!PENDING_CANCEL_STATUSES.has(subscription.status)) {
    return false
  }
  if (subscription.cancel_at_period_end === true) {
    return true
  }
  const now = Math.floor(Date.now() / 1000)
  if (subscription.cancel_at && subscription.cancel_at > now) {
    return true
  }
  if (subscription.canceled_at) {
    return true
  }
  if (subscription.cancellation_details?.reason === 'cancellation_requested') {
    return true
  }
  return false
}

/** Begin org closure (30-day retention) when the customer cancels billing in Stripe. */
export function shouldBeginOrganizationClosureFromSubscription(
  subscription: StripeSubscriptionCancellationSnapshot
): boolean {
  if (isStripeSubscriptionCancellationPending(subscription)) {
    return true
  }
  return mapStripeSubscriptionStatus(subscription.status) === 'canceled'
}

export async function findOrganizationByStripeIds(
  pb: PocketBase,
  customerId?: string | null,
  subscriptionId?: string | null
): Promise<Organization | null> {
  const subId = subscriptionId?.trim()
  if (subId) {
    try {
      return await pb.collection('organizations').getFirstListItem<Organization>(
        pbSelect('stripe_subscription_id', escapeFilterValue(subId))
      )
    } catch (error) {
      if (!(error instanceof ClientResponseError) || error.status !== 404) {
        throw error
      }
    }
  }

  const custId = customerId?.trim()
  if (custId) {
    try {
      return await pb.collection('organizations').getFirstListItem<Organization>(
        pbSelect('stripe_customer_id', escapeFilterValue(custId))
      )
    } catch (error) {
      if (!(error instanceof ClientResponseError) || error.status !== 404) {
        throw error
      }
    }
  }

  return null
}

export async function linkStripeBillingToOrganization(
  pb: PocketBase,
  organizationId: string,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<void> {
  const payload: Record<string, string> = {}
  if (stripeCustomerId?.trim()) {
    payload.stripe_customer_id = stripeCustomerId.trim()
  }
  if (stripeSubscriptionId?.trim()) {
    payload.stripe_subscription_id = stripeSubscriptionId.trim()
    payload.subscription_status = 'active'
  }
  if (!Object.keys(payload).length) return

  await pb.collection('organizations').update(organizationId, payload)
}

export async function syncOrganizationSubscription(
  pb: PocketBase,
  org: Organization,
  updates: {
    subscriptionStatus?: SubscriptionStatus
    plan?: OrganizationPlan
    stripeSubscriptionId?: string
    stripeCustomerId?: string
    reinstate?: boolean
  }
): Promise<void> {
  if (org.status === 'closing') return

  const payload: Record<string, string> = {}
  if (updates.subscriptionStatus) {
    payload.subscription_status = updates.subscriptionStatus
  }
  if (updates.plan) {
    payload.plan = updates.plan
  }
  if (updates.stripeSubscriptionId) {
    payload.stripe_subscription_id = updates.stripeSubscriptionId
  }
  if (updates.stripeCustomerId) {
    payload.stripe_customer_id = updates.stripeCustomerId
  }
  if (updates.reinstate) {
    payload.purge_scheduled_at = ''
    payload.closed_at = ''
  }
  if (!Object.keys(payload).length) return

  await pb.collection('organizations').update(org.id, payload)
}

export function canResubscribeOrganization(org: Organization): boolean {
  if (isOrganizationClosing(org)) return false
  return !hasActiveStripeSubscription(org)
}

export async function writeOrgActivityLog(
  pb: PocketBase,
  payload: {
    organizationId: string
    actorId?: string
    action: string
    details?: Record<string, unknown>
  }
): Promise<void> {
  const record: Record<string, unknown> = {
    organization: payload.organizationId,
    action: payload.action,
    details: payload.details ?? null
  }

  const actorId = payload.actorId?.trim()
  if (actorId) {
    record.actor = actorId
  }

  await pb.collection('team_activity_log').create(record)
}

/** Activity logging must not fail billing or webhook handlers. */
export async function tryWriteOrgActivityLog(
  pb: PocketBase,
  payload: Parameters<typeof writeOrgActivityLog>[1]
): Promise<void> {
  try {
    await writeOrgActivityLog(pb, payload)
  } catch (error) {
    console.warn('[orgBilling] team_activity_log write failed:', error)
  }
}

export function isOrganizationClosing(org: Pick<Organization, 'status'> | null | undefined): boolean {
  return org?.status === 'closing'
}

/** Paid subscription canceled — 30-day retention; org stays active and users can still sign in. */
export function isOrganizationInChurnRetention(
  org: Pick<Organization, 'status' | 'subscription_status' | 'purge_scheduled_at'> | null | undefined
): boolean {
  return org?.status === 'active'
    && org?.subscription_status === 'canceled'
    && Boolean(org?.purge_scheduled_at?.trim())
}

/** Re-open orgs that were incorrectly set to closing by an older Stripe cancel handler. */
export async function repairMistakenStripeClosure(
  pb: PocketBase,
  org: Organization
): Promise<Organization> {
  if (org.status !== 'closing' || org.closed_by?.trim()) {
    return org
  }

  const closedAt = org.closed_at ? new Date(org.closed_at) : new Date()
  const purgeScheduledAt = org.purge_scheduled_at?.trim()
    || computePurgeScheduledAt(closedAt).toISOString()

  await pb.collection('organizations').update(org.id, {
    status: 'active',
    subscription_status: 'canceled',
    plan: 'free',
    closed_at: closedAt.toISOString(),
    purge_scheduled_at: purgeScheduledAt
  })

  return pb.collection('organizations').getOne<Organization>(org.id)
}

export function hasActiveStripeSubscription(
  org: Pick<Organization, 'subscription_status'>
): boolean {
  const status = org.subscription_status ?? 'none'
  return status === 'active' || status === 'trialing' || status === 'past_due'
}

/** Whether a free org without Stripe billing can start in-dashboard upgrade checkout (J6/J7). */
export function canUpgradeOrganizationFromFree(org: Organization): boolean {
  return shouldUseCheckoutForPlanChange(org)
}

/** Start Stripe Checkout when there is no active subscription to update in place. */
export function shouldUseCheckoutForPlanChange(org: Organization): boolean {
  if (isOrganizationClosing(org)) return false
  const subscriptionId = org.stripe_subscription_id?.trim()
  if (!subscriptionId) return true
  return !hasActiveStripeSubscription(org)
}

/** @deprecated Use canUpgradeOrganizationFromFree */
export function canUpgradeOrganizationToStandard(org: Organization): boolean {
  return canUpgradeOrganizationFromFree(org)
}

export function describeUpgradeIneligibility(org: Organization): string {
  if (isOrganizationClosing(org)) {
    return 'This organization is closing and cannot be upgraded.'
  }
  if (org.plan !== 'free') {
    return 'Only free organizations can upgrade to a paid plan.'
  }
  if (hasActiveStripeSubscription(org)) {
    return 'This organization already has an active subscription.'
  }
  if (org.stripe_customer_id?.trim()) {
    return 'This organization already has a Stripe billing account. Use Manage billing instead.'
  }
  return 'This organization cannot be upgraded right now.'
}
