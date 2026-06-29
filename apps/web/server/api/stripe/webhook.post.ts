import { createError, getRequestHeader, readRawBody } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const stripeConfig = readStripeServerConfig(config)

  try {
    assertStripeWebhookConfigured(stripeConfig.webhookSecret)
  } catch (error) {
    throw createError({
      statusCode: 503,
      statusMessage: error instanceof Error ? error.message : 'Stripe webhook is not configured.'
    })
  }

  const signature = getRequestHeader(event, 'stripe-signature')
  if (!signature) {
    throw createError({ statusCode: 400, statusMessage: 'Missing stripe-signature header.' })
  }

  const rawBody = await readRawBody(event, 'utf8')
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: 'Missing request body.' })
  }

  const stripe = requireStripeClient(event)

  let stripeEvent
  try {
    stripeEvent = constructStripeWebhookEvent(
      stripe,
      rawBody,
      signature,
      stripeConfig.webhookSecret
    )
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Stripe webhook signature.' })
  }

  try {
    await handleStripeWebhookEvent(event, stripeEvent)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('[stripe/webhook]', error)
    throw createError({ statusCode: 500, statusMessage: 'Webhook handler failed.' })
  }

  return { received: true }
})
