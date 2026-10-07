import type Stripe from 'stripe'
import type { BillingInterval } from '~/utils/stripeCheckout'
import type { PaidCheckoutPlan } from '~/utils/planLimits'
import type { StripeServerConfig } from './stripeConfig'
import { resolveStripePriceId, validateCheckoutPlanPrice, validateStripePriceId } from './stripeConfig'
import { formatStripeCurrencyMismatchError } from './stripeBillingCurrency'

export function resolveStripePriceEnvName(
  plan: PaidCheckoutPlan,
  interval: BillingInterval,
  currency: string
): string {
  const suffix = currency.toLowerCase() === 'usd' ? '' : `_${currency.toUpperCase()}`
  const cadence = interval === 'annual' ? '_ANNUAL' : ''
  return `NUXT_STRIPE_${plan.toUpperCase()}${cadence}_PRICE_ID${suffix}`
}

export function resolveStripePriceIdForCurrency(
  stripeConfig: StripeServerConfig,
  plan: PaidCheckoutPlan,
  interval: BillingInterval,
  currency = 'usd'
): string {
  const normalized = currency.trim().toLowerCase() || 'usd'
  if (normalized === 'usd') {
    return resolveStripePriceId(stripeConfig, plan, interval)
  }

  let currencySpecific = ''
  if (interval === 'annual') {
    if (plan === 'starter') currencySpecific = stripeConfig.starterAnnualPriceIdAud
    else if (plan === 'team') currencySpecific = stripeConfig.teamAnnualPriceIdAud
    else currencySpecific = stripeConfig.businessAnnualPriceIdAud
  } else if (plan === 'starter') {
    currencySpecific = stripeConfig.starterPriceIdAud
  } else if (plan === 'team') {
    currencySpecific = stripeConfig.teamPriceIdAud
  } else {
    currencySpecific = stripeConfig.businessPriceIdAud
  }

  if (currencySpecific?.trim()) {
    return currencySpecific.trim()
  }

  // Single global price set. Main NUXT_STRIPE_*_PRICE_ID vars (currency validated at checkout).
  return resolveStripePriceId(stripeConfig, plan, interval)
}

export function validateCheckoutPlanPriceForCurrency(
  stripeConfig: StripeServerConfig,
  plan: PaidCheckoutPlan,
  interval: BillingInterval,
  currency = 'usd'
): string | null {
  const priceId = resolveStripePriceIdForCurrency(stripeConfig, plan, interval, currency)
  const envName = resolveStripePriceEnvName(plan, interval, currency)
  if (!priceId) {
    if (currency.toLowerCase() === 'usd') {
      return validateCheckoutPlanPrice(stripeConfig, plan, interval)
    }
    const fallback = validateCheckoutPlanPrice(stripeConfig, plan, interval)
    if (!fallback) return null
    return fallback
  }
  return validateStripePriceId(priceId, envName)
}

export async function assertStripePriceMatchesCurrency(
  stripe: Stripe,
  priceId: string,
  expectedCurrency: string,
  envHint: string
): Promise<void> {
  const price = await stripe.prices.retrieve(priceId)
  const priceCurrency = (price.currency || 'usd').toLowerCase()
  const expected = expectedCurrency.toLowerCase()
  if (priceCurrency !== expected) {
    throw new Error(formatStripeCurrencyMismatchError(expected, priceCurrency, envHint))
  }
}
