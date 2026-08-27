import type PocketBase from 'pocketbase'
import type Stripe from 'stripe'
import type { H3Event } from 'h3'
import type { Organization } from '~/types/sitenook'
import {
  computePurgeScheduledAt,
  isOrganizationInChurnRetention,
  repairMistakenStripeClosure,
  writeOrgActivityLog
} from './orgBilling'

export interface CloseOrganizationResult {
  organizationId: string
  subdomain: string
  purgeScheduledAt: string
  subscriptionCanceled: boolean
}

export interface CloseOrganizationInput {
  organizationId: string
  actorId: string
  confirmName: string
  event?: H3Event
}

export type OrganizationClosureSource = 'admin' | 'stripe_subscription'

export interface BeginOrganizationClosureOptions {
  actorId?: string
  source: OrganizationClosureSource
  /** Admin-initiated close cancels Stripe; Stripe-initiated close skips (already canceled). */
  cancelStripeSubscription?: boolean
  closureDetails?: Record<string, unknown>
  event?: H3Event
}

async function cancelOrgScans(pb: PocketBase, organizationId: string): Promise<void> {
  const sites = await pb.collection('sites').getFullList({
    filter: `organization = "${organizationId}"`,
    fields: 'id'
  })

  for (const site of sites) {
    const siteId = site.id

    const queueItems = await pb.collection('scan_queue').getFullList({
      filter: `site = "${siteId}" && (status = "pending" || status = "processing")`,
      fields: 'id'
    })
    await Promise.all(
      queueItems.map(item => pb.collection('scan_queue').update(item.id, { status: 'cancelled' }))
    )

    const runningScans = await pb.collection('scans').getFullList({
      filter: `site = "${siteId}" && status = "running"`,
      fields: 'id'
    })
    await Promise.all(
      runningScans.map(item => pb.collection('scans').update(item.id, { status: 'cancelled' }))
    )
  }
}

async function cancelStripeSubscription(
  stripe: Stripe | null,
  subscriptionId?: string
): Promise<boolean> {
  const subId = subscriptionId?.trim()
  if (!subId || !stripe) return false

  try {
    await stripe.subscriptions.cancel(subId)
    return true
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code?: string }).code || '')
      if (code === 'resource_missing') {
        return false
      }
    }
    throw error
  }
}

/** Shared soft-close: block access, stop scans, schedule purge in 30 days. */
export async function beginOrganizationClosure(
  pb: PocketBase,
  stripe: Stripe | null,
  org: Organization,
  options: BeginOrganizationClosureOptions
): Promise<CloseOrganizationResult | null> {
  if (org.status === 'closing') {
    return null
  }

  const closedAt = new Date()
  const purgeScheduledAt = computePurgeScheduledAt(closedAt)
  const subscriptionCanceled = options.cancelStripeSubscription
    ? await cancelStripeSubscription(stripe, org.stripe_subscription_id)
    : false

  await cancelOrgScans(pb, org.id)

  const updatePayload: Record<string, string> = {
    status: 'closing',
    closed_at: closedAt.toISOString(),
    purge_scheduled_at: purgeScheduledAt.toISOString(),
    subscription_status: 'canceled'
  }
  const actorId = options.actorId?.trim()
  if (actorId) {
    updatePayload.closed_by = actorId
  }

  await pb.collection('organizations').update(org.id, updatePayload)

  await writeOrgActivityLog(pb, {
    organizationId: org.id,
    actorId: options.actorId,
    action: 'org_closed',
    details: {
      plan: org.plan ?? 'free',
      purgeScheduledAt: purgeScheduledAt.toISOString(),
      subscriptionCanceled,
      ...options.closureDetails,
      source: options.source
    }
  })

  return {
    organizationId: org.id,
    subdomain: String(org.subdomain || ''),
    purgeScheduledAt: purgeScheduledAt.toISOString(),
    subscriptionCanceled
  }
}

export async function closeOrganization(
  pb: PocketBase,
  stripe: Stripe | null,
  input: CloseOrganizationInput
): Promise<CloseOrganizationResult> {
  const org = await pb.collection('organizations').getOne<Organization>(input.organizationId)

  if (org.status === 'closing') {
    throw new Error('This organization is already closing.')
  }

  const orgName = String(org.name || '').trim()
  if (!orgName || input.confirmName.trim() !== orgName) {
    throw new Error('Organization name does not match. Type the exact organization name to confirm.')
  }

  const result = await beginOrganizationClosure(pb, stripe, org, {
    actorId: input.actorId,
    source: 'admin',
    cancelStripeSubscription: true,
    closureDetails: {},
    event: input.event
  })

  if (!result) {
    throw new Error('This organization is already closing.')
  }

  return result
}

export interface SubscriptionChurnResult {
  organizationId: string
  subdomain: string
  purgeScheduledAt: string
}

export async function beginSubscriptionChurnRetention(
  pb: PocketBase,
  org: Organization,
  closureDetails?: Record<string, unknown>
): Promise<SubscriptionChurnResult | null> {
  if (org.status === 'closing') {
    return null
  }
  if (isOrganizationInChurnRetention(org)) {
    return null
  }

  const churnedAt = new Date()
  const purgeScheduledAt = computePurgeScheduledAt(churnedAt)

  await cancelOrgScans(pb, org.id)

  await pb.collection('organizations').update(org.id, {
    status: 'active',
    subscription_status: 'canceled',
    plan: org.plan ?? 'free',
    closed_at: churnedAt.toISOString(),
    purge_scheduled_at: purgeScheduledAt.toISOString()
  })

  await writeOrgActivityLog(pb, {
    organizationId: org.id,
    action: 'subscription_updated',
    details: {
      plan: org.plan ?? 'free',
      purgeScheduledAt: purgeScheduledAt.toISOString(),
      churnRetention: true,
      source: 'stripe_subscription',
      ...closureDetails
    }
  })

  return {
    organizationId: org.id,
    subdomain: String(org.subdomain || ''),
    purgeScheduledAt: purgeScheduledAt.toISOString()
  }
}

export async function closeOrganizationFromStripeSubscription(
  pb: PocketBase,
  org: Organization,
  closureDetails?: Record<string, unknown>,
  _event?: H3Event
): Promise<SubscriptionChurnResult | null> {
  return beginSubscriptionChurnRetention(pb, org, closureDetails)
}
