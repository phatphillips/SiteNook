import { createError } from 'h3'
import type { BillingInterval } from '~/utils/stripeCheckout'
import { parseBillingInterval } from '~/utils/stripeCheckout'
import { formatStripeCheckoutError } from '../../utils/stripeCheckoutSession'
import {
  assertStripeCheckoutConfigured,
  isStripeSelfHostCheckoutConfigured,
  readStripeServerConfig,
  resolveSelfHostStripePriceId,
  validateSelfHostCheckoutPrice,
  validateStripeSecretKey
} from '../../utils/stripeConfig'

interface CreateSelfHostCheckoutBody {
  interval?: string
}

export default defineEventHandler(async (event) => {
  assertSelfServiceSignupEnabled(event)
  assertApexHostForSelfService(event)

  const ip = getClientIp(event)
  assertRateLimit(event, `stripe-selfhost-checkout:ip:${ip}`, { max: 20, windowMs: 60 * 60_000 })

  const body = await readBody<CreateSelfHostCheckoutBody>(event)
  const interval = parseBillingInterval(body?.interval) as BillingInterval
  const config = useRuntimeConfig(event)
  const stripeConfig = readStripeServerConfig(config)

  // Reuse secret-key assert; Self-host also needs its own price IDs.
  assertStripeCheckoutConfigured(stripeConfig)
  if (!isStripeSelfHostCheckoutConfigured(stripeConfig)) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Self-host Stripe checkout is not configured. Set NUXT_STRIPE_SELFHOST_PRICE_ID.'
    })
  }

  const priceError = validateSelfHostCheckoutPrice(stripeConfig, interval)
  if (priceError) {
    throw createError({ statusCode: 500, statusMessage: priceError })
  }

  const keyError = validateStripeSecretKey(stripeConfig.secretKey)
  if (keyError) {
    throw createError({ statusCode: 500, statusMessage: keyError })
  }

  const appUrl = config.public.appUrl.replace(/\/$/, '')
  const stripe = requireStripeClient(event)
  const priceId = resolveSelfHostStripePriceId(stripeConfig, interval)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/download?licence=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/download?checkout=cancelled`,
      customer_email: undefined,
      metadata: {
        sitenook_product: 'selfhost',
        sitenook_plan: 'selfhost',
        sitenook_interval: interval
      },
      subscription_data: {
        metadata: {
          sitenook_product: 'selfhost',
          sitenook_plan: 'selfhost',
          sitenook_interval: interval
        }
      }
    })

    if (!session.url) {
      throw createError({ statusCode: 502, statusMessage: 'Stripe did not return a checkout URL.' })
    }

    return { url: session.url, sessionId: session.id }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 502,
      statusMessage: formatStripeCheckoutError(error)
    })
  }
})
