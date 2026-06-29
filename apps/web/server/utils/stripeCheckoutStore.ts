import type PocketBase from 'pocketbase'
import { ClientResponseError } from 'pocketbase'
import type { OrganizationPlan } from '~/types/accessiq'
import { pbSelect } from '~/utils/pbFilter'
import { linkStripeBillingToOrganization } from './orgBilling'
import type {
  PaidCheckoutUpsertInput,
  StripeCheckoutSessionRecord
} from './stripeCheckoutRecord'
import { isStoredCheckoutSessionValid } from './stripeCheckoutRecord'

const COLLECTION = 'stripe_checkout_sessions'

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
}

export async function upsertPaidCheckoutSession(
  pb: PocketBase,
  input: PaidCheckoutUpsertInput
): Promise<StripeCheckoutSessionRecord> {
  const filter = pbSelect('session_id', escapeFilterValue(input.sessionId))

  try {
    const existing = await pb.collection(COLLECTION).getFirstListItem<StripeCheckoutSessionRecord>(filter)
    if (existing.status === 'paid' || existing.status === 'consumed') {
      return existing
    }
    return await pb.collection(COLLECTION).update<StripeCheckoutSessionRecord>(existing.id, {
      plan: input.plan,
      customer_email: input.customerEmail ?? '',
      status: 'paid',
      paid_at: input.paidAt.toISOString(),
      expires_at: input.expiresAt.toISOString(),
      stripe_customer_id: input.stripeCustomerId ?? '',
      stripe_subscription_id: input.stripeSubscriptionId ?? ''
    })
  } catch (error) {
    if (!(error instanceof ClientResponseError) || error.status !== 404) {
      throw error
    }
  }

  return await pb.collection(COLLECTION).create<StripeCheckoutSessionRecord>({
    session_id: input.sessionId,
    plan: input.plan,
    customer_email: input.customerEmail ?? '',
    status: 'paid',
    paid_at: input.paidAt.toISOString(),
    expires_at: input.expiresAt.toISOString(),
    stripe_customer_id: input.stripeCustomerId ?? '',
    stripe_subscription_id: input.stripeSubscriptionId ?? ''
  })
}

export async function findValidPaidCheckoutSession(
  pb: PocketBase,
  sessionId: string,
  expectedPlan?: OrganizationPlan
): Promise<StripeCheckoutSessionRecord | null> {
  const trimmed = sessionId.trim()
  if (!trimmed.startsWith('cs_')) return null

  try {
    const record = await pb.collection(COLLECTION).getFirstListItem<StripeCheckoutSessionRecord>(
      pbSelect('session_id', escapeFilterValue(trimmed))
    )
    if (expectedPlan && record.plan !== expectedPlan) return null
    if (!isStoredCheckoutSessionValid(record)) return null
    return record
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function markCheckoutSessionConsumed(
  pb: PocketBase,
  sessionId: string,
  organizationId: string
): Promise<void> {
  const trimmed = sessionId.trim()
  if (!trimmed.startsWith('cs_')) return

  try {
    const record = await pb.collection(COLLECTION).getFirstListItem<StripeCheckoutSessionRecord>(
      pbSelect('session_id', escapeFilterValue(trimmed))
    )
    await pb.collection(COLLECTION).update(record.id, {
      status: 'consumed',
      organization: organizationId
    })

    await linkStripeBillingToOrganization(
      pb,
      organizationId,
      record.stripe_customer_id,
      record.stripe_subscription_id
    )
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return
    }
    throw error
  }
}
