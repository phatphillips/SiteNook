import type Stripe from 'stripe'
import type { Organization } from '~/types/accessiq'

export async function resolveOrganizationBillingCurrency(
  stripe: Stripe,
  org: Pick<Organization, 'stripe_subscription_id' | 'stripe_customer_id'>
): Promise<string> {
  const subscriptionId = org.stripe_subscription_id?.trim()
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      if (subscription.currency) {
        return subscription.currency.toLowerCase()
      }
    } catch {
      // Fall through to customer lookup.
    }
  }

  const customerId = org.stripe_customer_id?.trim()
  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId)
      if (!('deleted' in customer && customer.deleted)) {
        const currency = (customer as Stripe.Customer).currency
        if (currency) {
          return currency.toLowerCase()
        }
      }
    } catch {
      // Default below.
    }
  }

  return 'usd'
}

export function formatStripeCurrencyMismatchError(
  expectedCurrency: string,
  priceCurrency: string,
  envHint: string
): string {
  return `Your Stripe billing uses ${expectedCurrency.toUpperCase()}, but the configured price is ${priceCurrency.toUpperCase()}. `
    + envHint
}
