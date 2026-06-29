import type Stripe from 'stripe'
import type { BillingInterval } from '~/utils/stripeCheckout'
import type { PaidCheckoutPlan } from '~/utils/planLimits'

export function resolveSubscriptionItemPriceId(
  item: Stripe.SubscriptionItem | undefined
): string | null {
  const price = item?.price
  if (!price) return null
  return typeof price === 'string' ? price : price.id ?? null
}

export async function changeActiveSubscriptionPlan(
  stripe: Stripe,
  subscriptionId: string,
  priceId: string,
  targetPlan: PaidCheckoutPlan,
  interval: BillingInterval,
  expectedCurrency?: string
): Promise<{ subscription: Stripe.Subscription, priceChanged: boolean }> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const item = subscription.items.data[0]
  const itemId = item?.id
  if (!itemId) {
    throw new Error('Could not read the current Stripe subscription item.')
  }

  const billingCurrency = expectedCurrency?.toLowerCase() || subscription.currency?.toLowerCase() || 'usd'
  const price = await stripe.prices.retrieve(priceId)
  const priceCurrency = (price.currency || 'usd').toLowerCase()
  if (priceCurrency !== billingCurrency) {
    throw new Error(
      `This subscription is billed in ${billingCurrency.toUpperCase()}, but your selected plan price is ${priceCurrency.toUpperCase()}. `
      + `Stripe cannot change currency on an existing subscription. Cancel the current subscription in Manage billing, `
      + `click Refresh billing status, then resubscribe to ${targetPlan.toUpperCase()} to start a new ${priceCurrency.toUpperCase()} subscription.`
    )
  }

  const currentPriceId = resolveSubscriptionItemPriceId(item)
  if (currentPriceId === priceId) {
    return { subscription, priceChanged: false }
  }

  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'create_prorations',
    metadata: {
      accessiq_plan: targetPlan,
      accessiq_interval: interval
    }
  })

  return { subscription: updated, priceChanged: true }
}
