import { randomBytes } from 'node:crypto'
import type PocketBase from 'pocketbase'
import type Stripe from 'stripe'
import type { LicenceTier } from '~/utils/licenceTiers'

export interface IssueSelfHostLicenceInput {
  customerEmail: string
  stripeSubscriptionId: string
  stripeCheckoutSessionId: string
  stripeCustomerId?: string
  /** Months of validity when subscription period is unknown */
  validityMonths?: number
  expiresAt?: string
}

export interface LicenceRecordLike {
  id: string
  key: string
  tier: string
  expires_at: string
  revoked?: boolean
  stripe_subscription_id?: string
  stripe_checkout_session_id?: string
  customer_email?: string
}

export function generateLicenceKey(prefix = 'nook'): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`
}

export function defaultSelfHostExpiry(months = 1, from = new Date()): string {
  const d = new Date(from)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString()
}

export function isSelfHostCheckoutSession(session: Stripe.Checkout.Session): boolean {
  const product = String(session.metadata?.sitenook_product || '').trim().toLowerCase()
  const plan = String(session.metadata?.sitenook_plan || '').trim().toLowerCase()
  return product === 'selfhost' || plan === 'selfhost'
}

export function extractSelfHostCheckoutEmail(session: Stripe.Checkout.Session): string {
  return String(
    session.customer_details?.email
    || session.customer_email
    || session.metadata?.customer_email
    || ''
  ).trim().toLowerCase()
}

/**
 * Create or return an existing Self-host licence for a Stripe checkout session (idempotent).
 */
export async function issueSelfHostLicenceFromCheckout(
  pb: PocketBase,
  input: IssueSelfHostLicenceInput
): Promise<{ licence: LicenceRecordLike, created: boolean }> {
  const sessionId = input.stripeCheckoutSessionId.trim()
  if (sessionId) {
    try {
      const existing = await pb.collection('licences').getFirstListItem(
        `stripe_checkout_session_id = ${JSON.stringify(sessionId)}`
      ) as LicenceRecordLike
      return { licence: existing, created: false }
    } catch {
      // not found
    }
  }

  if (input.stripeSubscriptionId.trim()) {
    try {
      const existing = await pb.collection('licences').getFirstListItem(
        `stripe_subscription_id = ${JSON.stringify(input.stripeSubscriptionId.trim())} && revoked = false`
      ) as LicenceRecordLike
      return { licence: existing, created: false }
    } catch {
      // not found
    }
  }

  const expiresAt = input.expiresAt || defaultSelfHostExpiry(input.validityMonths ?? 1)
  const key = generateLicenceKey()
  const created = await pb.collection('licences').create({
    key,
    tier: 'selfhost' satisfies LicenceTier,
    expires_at: expiresAt,
    revoked: false,
    stripe_subscription_id: input.stripeSubscriptionId || '',
    stripe_checkout_session_id: sessionId,
    customer_email: input.customerEmail,
    notes: input.stripeCustomerId
      ? `Issued via Stripe customer ${input.stripeCustomerId}`
      : 'Issued via Stripe Self-host checkout'
  }) as LicenceRecordLike

  return { licence: created, created: true }
}

export async function revokeLicencesForStripeSubscription(
  pb: PocketBase,
  stripeSubscriptionId: string
): Promise<number> {
  const subId = stripeSubscriptionId.trim()
  if (!subId) return 0

  const rows = await pb.collection('licences').getFullList({
    filter: `stripe_subscription_id = ${JSON.stringify(subId)} && revoked = false`
  })

  let count = 0
  for (const row of rows) {
    await pb.collection('licences').update(row.id, { revoked: true })
    count += 1
  }
  return count
}

export async function renewLicenceExpiryForSubscription(
  pb: PocketBase,
  stripeSubscriptionId: string,
  expiresAt: string
): Promise<number> {
  const subId = stripeSubscriptionId.trim()
  if (!subId) return 0

  const rows = await pb.collection('licences').getFullList({
    filter: `stripe_subscription_id = ${JSON.stringify(subId)}`
  })

  let count = 0
  for (const row of rows) {
    await pb.collection('licences').update(row.id, {
      expires_at: expiresAt,
      revoked: false,
      tier: 'selfhost'
    })
    count += 1
  }
  return count
}
