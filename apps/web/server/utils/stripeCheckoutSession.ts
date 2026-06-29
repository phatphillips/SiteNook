import type Stripe from 'stripe'
import type { OrganizationPlan } from '~/types/accessiq'
import type { BillingInterval } from '~/utils/stripeCheckout'

export interface CheckoutSessionOptions {
  plan: OrganizationPlan
  priceId: string
  successUrl: string
  cancelUrl: string
  organizationId?: string
  customerId?: string
  interval?: BillingInterval
}

export function buildCheckoutSessionParams(
  options: CheckoutSessionOptions
): Stripe.Checkout.SessionCreateParams {
  const metadata: Record<string, string> = {
    accessiq_plan: options.plan,
    accessiq_interval: options.interval ?? 'monthly'
  }
  if (options.organizationId?.trim()) {
    metadata.organization_id = options.organizationId.trim()
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: options.priceId, quantity: 1 }],
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata,
    subscription_data: { metadata: { ...metadata } }
  }

  const customerId = options.customerId?.trim()
  if (customerId) {
    params.customer = customerId
  }

  return params
}

/** @deprecated Use buildCheckoutSessionParams */
export function buildStandardCheckoutSessionParams(
  options: {
    standardPriceId: string
    successUrl: string
    cancelUrl: string
    organizationId?: string
  }
): Stripe.Checkout.SessionCreateParams {
  return buildCheckoutSessionParams({
    plan: 'team',
    priceId: options.standardPriceId,
    successUrl: options.successUrl,
    cancelUrl: options.cancelUrl,
    organizationId: options.organizationId
  })
}

export function formatStripeCheckoutError(error: unknown): string {
  if (error && typeof error === 'object' && 'type' in error) {
    const stripeError = error as Stripe.errors.StripeError
    if (stripeError.type === 'StripeInvalidRequestError') {
      if (/price/i.test(stripeError.message) && /prod_/i.test(stripeError.message)) {
        return 'Invalid price ID. Use a Price ID (price_…) from Stripe, not a Product ID (prod_…).'
      }
      return stripeError.message
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Could not start Stripe checkout. Please try again.'
}
