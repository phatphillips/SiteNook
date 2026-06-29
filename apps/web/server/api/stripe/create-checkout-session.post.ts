import { createError } from 'h3'
import type { BillingInterval } from '~/utils/stripeCheckout'
import { parseBillingInterval } from '~/utils/stripeCheckout'
import {
  buildCheckoutSessionParams,
  formatStripeCheckoutError
} from '../../utils/stripeCheckoutSession'
import {
  assertStripeCheckoutConfigured,
  parseCheckoutPlanInput,
  readStripeServerConfig,
  resolveStripePriceId,
  validateCheckoutPlanPrice,
  validateStripeSecretKey
} from '../../utils/stripeConfig'

interface CreateCheckoutSessionBody {
  plan?: string
  interval?: string
}

export default defineEventHandler(async (event) => {
  assertSelfServiceSignupEnabled(event)
  assertApexHostForSelfService(event)

  const ip = getClientIp(event)
  assertRateLimit(event, `stripe-checkout:ip:${ip}`, { max: 20, windowMs: 60 * 60_000 })

  const body = await readBody<CreateCheckoutSessionBody>(event)
  const plan = parseCheckoutPlanInput(body?.plan)
  if (!plan) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose a paid plan (starter, team, or business) for Stripe checkout.'
    })
  }

  const interval = parseBillingInterval(body?.interval)
  const config = useRuntimeConfig(event)
  const stripeConfig = readStripeServerConfig(config)
  assertStripeCheckoutConfigured(stripeConfig)

  const priceError = validateCheckoutPlanPrice(stripeConfig, plan, interval)
  if (priceError) {
    throw createError({ statusCode: 500, statusMessage: priceError })
  }

  const keyError = validateStripeSecretKey(stripeConfig.secretKey)
  if (keyError) {
    throw createError({ statusCode: 500, statusMessage: keyError })
  }

  const appUrl = config.public.appUrl.replace(/\/$/, '')
  const stripe = requireStripeClient(event)
  const priceId = resolveStripePriceId(stripeConfig, plan, interval)

  try {
    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({
        plan,
        priceId,
        interval,
        successUrl: `${appUrl}/start?checkout={CHECKOUT_SESSION_ID}&plan=${plan}`,
        cancelUrl: `${appUrl}/pricing?checkout=cancelled`
      })
    )

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
