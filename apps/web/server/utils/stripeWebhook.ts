import type { H3Event } from 'h3'
import type Stripe from 'stripe'
import { ClientResponseError } from 'pocketbase'
import type { Organization } from '~/types/accessiq'
import { buildPaidCheckoutUpsertInput, resolveCheckoutOrganizationId } from './stripeCheckoutRecord'
import { markCheckoutSessionConsumed, upsertPaidCheckoutSession } from './stripeCheckoutStore'
import {
  findOrganizationByStripeIds,
  mapStripeSubscriptionStatus,
  isOrganizationInChurnRetention,
  repairMistakenStripeClosure,
  shouldBeginOrganizationClosureFromSubscription,
  syncOrganizationSubscription,
  tryWriteOrgActivityLog
} from './orgBilling'
import { closeOrganizationFromStripeSubscription } from './closeOrganization'
import { notifyOrgChurnEmails } from './orgClosureNotify'
import { isOrganizationPlan } from '~/utils/planPricing'
import { readStripeServerConfig, resolvePlanFromStripePriceId } from './stripeConfig'

export function assertStripeWebhookConfigured(webhookSecret: string): void {
  if (!webhookSecret.trim()) {
    throw new Error('NUXT_STRIPE_WEBHOOK_SECRET is not configured.')
  }
}

export function constructStripeWebhookEvent(
  stripe: Stripe,
  rawBody: string,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}

export async function handleStripeWebhookEvent(
  event: H3Event,
  stripeEvent: Stripe.Event
): Promise<void> {
  switch (stripeEvent.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event, stripeEvent.data.object as Stripe.Checkout.Session)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event, stripeEvent.data.object as Stripe.Subscription)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event, stripeEvent.data.object as Stripe.Subscription)
      break
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event, stripeEvent.data.object as Stripe.Invoice)
      break
  }
}

async function handleCheckoutSessionCompleted(
  event: H3Event,
  session: Stripe.Checkout.Session
): Promise<void> {
  const upsertInput = buildPaidCheckoutUpsertInput(session)
  if (!upsertInput) return

  const pb = await getPbAdmin(event)
  await upsertPaidCheckoutSession(pb, upsertInput)

  const organizationId = resolveCheckoutOrganizationId(session)
  if (!organizationId) return

  let org: Organization
  try {
    org = await pb.collection('organizations').getOne<Organization>(organizationId)
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return
    }
    throw error
  }

  if (org.status === 'closing') return

  const reinstate = isOrganizationInChurnRetention(org)
    || (org.subscription_status === 'canceled' && Boolean(org.purge_scheduled_at?.trim()))

  await syncOrganizationSubscription(pb, org, {
    subscriptionStatus: 'active',
    plan: upsertInput.plan,
    stripeCustomerId: upsertInput.stripeCustomerId,
    stripeSubscriptionId: upsertInput.stripeSubscriptionId,
    reinstate
  })

  await markCheckoutSessionConsumed(pb, session.id, organizationId)

  await tryWriteOrgActivityLog(pb, {
    organizationId,
    action: 'subscription_updated',
    details: {
      plan: upsertInput.plan,
      source: 'checkout.session.completed',
      upgraded: true
    }
  })
}

async function handleSubscriptionUpdated(
  event: H3Event,
  subscription: Stripe.Subscription
): Promise<void> {
  const pb = await getPbAdmin(event)
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id
  let org = await findOrganizationByStripeIds(pb, customerId, subscription.id)
  if (!org) return

  if (org.status === 'closing') {
    org = await repairMistakenStripeClosure(pb, org)
  }

  if (shouldBeginOrganizationClosureFromSubscription(subscription)) {
    const started = await closeOrganizationFromStripeSubscription(pb, org, {
      stripeSubscriptionId: subscription.id,
      stripeStatus: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      stripeEvent: 'customer.subscription.updated'
    }, event)
    if (started) {
      await notifyOrgChurnEmails(event, org.id)
    }
    return
  }

  if (org.status === 'closing') return

  const metadataPlan = subscription.metadata?.accessiq_plan
  let plan = isOrganizationPlan(metadataPlan) ? metadataPlan : undefined
  if (!plan) {
    const config = useRuntimeConfig(event)
    const stripeConfig = readStripeServerConfig(config)
    const priceId = subscription.items.data[0]?.price?.id
    plan = resolvePlanFromStripePriceId(
      stripeConfig,
      priceId,
      config.stripeStandardPriceId
    ) ?? undefined
  }

  await syncOrganizationSubscription(pb, org, {
    subscriptionStatus: mapStripeSubscriptionStatus(subscription.status),
    plan,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId
  })

  await tryWriteOrgActivityLog(pb, {
    organizationId: org.id,
    action: 'subscription_updated',
    details: {
      status: subscription.status,
      plan: plan ?? org.plan
    }
  })
}

async function handleSubscriptionDeleted(
  event: H3Event,
  subscription: Stripe.Subscription
): Promise<void> {
  const pb = await getPbAdmin(event)
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id
  let org = await findOrganizationByStripeIds(pb, customerId, subscription.id)
  if (!org) return

  if (org.status === 'closing') {
    org = await repairMistakenStripeClosure(pb, org)
  }
  if (org.status === 'closing') return

  const started = await closeOrganizationFromStripeSubscription(pb, org, {
    stripeSubscriptionId: subscription.id,
    stripeStatus: 'deleted',
    stripeEvent: 'customer.subscription.deleted'
  }, event)
  if (started) {
    await notifyOrgChurnEmails(event, org.id)
  }
}

async function handleInvoicePaymentFailed(
  event: H3Event,
  invoice: Stripe.Invoice
): Promise<void> {
  const pb = await getPbAdmin(event)
  const subscriptionRef = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription
  const subscriptionId = typeof subscriptionRef === 'string'
    ? subscriptionRef
    : subscriptionRef?.id
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id
  const org = await findOrganizationByStripeIds(pb, customerId, subscriptionId)
  if (!org || org.status === 'closing') return

  await syncOrganizationSubscription(pb, org, {
    subscriptionStatus: 'past_due'
  })
}
