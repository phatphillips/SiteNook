import type { H3Event } from 'h3'
import Stripe from 'stripe'
import {
  assertStripeCheckoutConfigured,
  isStripeCheckoutConfigured,
  readStripeServerConfig,
  validateStripeSecretKey
} from './stripeConfig'

let stripeClient: Stripe | null = null
let stripeClientKey: string | null = null

export function getStripeClient(event?: H3Event): Stripe | null {
  const config = useRuntimeConfig(event)
  const stripeConfig = readStripeServerConfig(config)
  if (!isStripeCheckoutConfigured(stripeConfig)) {
    return null
  }

  const keyError = validateStripeSecretKey(stripeConfig.secretKey)
  if (keyError) {
    throw new Error(keyError)
  }

  if (!stripeClient || stripeClientKey !== stripeConfig.secretKey) {
    stripeClient = new Stripe(stripeConfig.secretKey, {
      typescript: true
    })
    stripeClientKey = stripeConfig.secretKey
  }

  return stripeClient
}

export function requireStripeClient(event?: H3Event): Stripe {
  const config = useRuntimeConfig(event)
  const stripeConfig = readStripeServerConfig(config)
  assertStripeCheckoutConfigured(stripeConfig)

  const client = getStripeClient(event)
  if (!client) {
    throw new Error('Stripe client could not be initialized.')
  }

  return client
}
