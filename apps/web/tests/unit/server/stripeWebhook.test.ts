import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import {
  assertStripeWebhookConfigured,
  constructStripeWebhookEvent
} from '../../../server/utils/stripeWebhook'

describe('stripeWebhook', () => {
  it('requires webhook secret', () => {
    expect(() => assertStripeWebhookConfigured('')).toThrow(/NUXT_STRIPE_WEBHOOK_SECRET/)
    expect(() => assertStripeWebhookConfigured('whsec_test')).not.toThrow()
  })

  it('constructs signed webhook events', () => {
    const stripe = new Stripe('sk_test_construct')
    const secret = 'whsec_test_secret'
    const payload = JSON.stringify({
      id: 'evt_test',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test' } }
    })
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret })

    const event = constructStripeWebhookEvent(stripe, payload, signature, secret)
    expect(event.type).toBe('checkout.session.completed')
  })

  it('rejects invalid signatures', () => {
    const stripe = new Stripe('sk_test_construct')
    expect(() => constructStripeWebhookEvent(
      stripe,
      '{}',
      'invalid',
      'whsec_test_secret'
    )).toThrow()
  })
})
