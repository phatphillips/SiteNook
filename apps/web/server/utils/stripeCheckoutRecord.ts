import type Stripe from 'stripe'
import type { OrganizationPlan } from '~/types/sitenook'
import { normalizeOrganizationPlan } from '~/utils/planLimits'

export type StripeCheckoutSessionStatus = 'paid' | 'consumed' | 'expired'

export interface StripeCheckoutSessionRecord {
  id: string
  session_id: string
  plan: OrganizationPlan
  customer_email?: string
  status: StripeCheckoutSessionStatus
  paid_at: string
  expires_at: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  organization?: string
}

export interface PaidCheckoutUpsertInput {
  sessionId: string
  plan: OrganizationPlan
  customerEmail?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  paidAt: Date
  expiresAt: Date
}

/** How long a paid checkout session can be used to open /start (G6). */
export const STRIPE_CHECKOUT_VALIDITY_MS = 24 * 60 * 60 * 1000

export function resolveCheckoutOrganizationId(session: Stripe.Checkout.Session): string | undefined {
  const orgId = session.metadata?.organization_id?.trim()
  return orgId || undefined
}

export function resolveCheckoutPlanFromSession(session: Stripe.Checkout.Session): OrganizationPlan {
  const metadataPlan = session.metadata?.sitenook_plan
  if (typeof metadataPlan === 'string' && metadataPlan.trim()) {
    return normalizeOrganizationPlan(metadataPlan)
  }
  return 'team'
}

export function resolveCheckoutCustomerEmail(session: Stripe.Checkout.Session): string | undefined {
  const email = session.customer_details?.email
    || session.customer_email
    || undefined
  return email?.trim().toLowerCase() || undefined
}

export function isCheckoutSessionPaid(session: Stripe.Checkout.Session): boolean {
  if (session.status !== 'complete') return false
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
    return true
  }
  return false
}

export function buildPaidCheckoutUpsertInput(
  session: Stripe.Checkout.Session,
  now: Date = new Date()
): PaidCheckoutUpsertInput | null {
  if (!isCheckoutSessionPaid(session)) return null
  if (!session.id?.startsWith('cs_')) return null

  return {
    sessionId: session.id,
    plan: resolveCheckoutPlanFromSession(session),
    customerEmail: resolveCheckoutCustomerEmail(session),
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    stripeSubscriptionId: typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id,
    paidAt: now,
    expiresAt: new Date(now.getTime() + STRIPE_CHECKOUT_VALIDITY_MS)
  }
}

export function isStoredCheckoutSessionValid(
  record: Pick<StripeCheckoutSessionRecord, 'status' | 'expires_at'>,
  now: Date = new Date()
): boolean {
  if (record.status !== 'paid') return false
  const expiresAt = Date.parse(record.expires_at)
  if (Number.isNaN(expiresAt)) return false
  return expiresAt > now.getTime()
}
