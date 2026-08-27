import type { H3Event } from 'h3'
import type { BillingInterval } from '~/utils/stripeCheckout'
import {
  isDevCheckoutBypassToken,
  STRIPE_CHECKOUT_DEV_BYPASS
} from '~/utils/stripeCheckout'
import type { PaidCheckoutPlan } from '~/utils/planLimits'
import { isPaidCheckoutPlan } from '~/utils/planLimits'

export interface StripeServerConfig {
  secretKey: string
  webhookSecret: string
  starterPriceId: string
  teamPriceId: string
  businessPriceId: string
  starterPriceIdAud: string
  teamPriceIdAud: string
  businessPriceIdAud: string
  starterAnnualPriceId: string
  teamAnnualPriceId: string
  businessAnnualPriceId: string
  starterAnnualPriceIdAud: string
  teamAnnualPriceIdAud: string
  businessAnnualPriceIdAud: string
  selfhostPriceId: string
  selfhostAnnualPriceId: string
  publishableKey: string
  devBypassToken: string
}

export function readStripeServerConfig(config: {
  stripeSecretKey?: string
  stripeWebhookSecret?: string
  stripeStarterPriceId?: string
  stripeTeamPriceId?: string
  stripeBusinessPriceId?: string
  stripeStandardPriceId?: string
  stripeStarterAnnualPriceId?: string
  stripeTeamAnnualPriceId?: string
  stripeBusinessAnnualPriceId?: string
  stripeStarterPriceIdAud?: string
  stripeTeamPriceIdAud?: string
  stripeBusinessPriceIdAud?: string
  stripeStarterAnnualPriceIdAud?: string
  stripeTeamAnnualPriceIdAud?: string
  stripeBusinessAnnualPriceIdAud?: string
  stripeSelfhostPriceId?: string
  stripeSelfhostAnnualPriceId?: string
  stripeDevBypassToken?: string
  public?: { stripePublishableKey?: string }
}): StripeServerConfig {
  const teamFallback = config.stripeTeamPriceId?.trim()
    || config.stripeStandardPriceId?.trim()
    || ''

  return {
    secretKey: config.stripeSecretKey?.trim() || '',
    webhookSecret: config.stripeWebhookSecret?.trim() || '',
    starterPriceId: config.stripeStarterPriceId?.trim() || '',
    teamPriceId: teamFallback,
    businessPriceId: config.stripeBusinessPriceId?.trim() || '',
    starterPriceIdAud: config.stripeStarterPriceIdAud?.trim() || '',
    teamPriceIdAud: config.stripeTeamPriceIdAud?.trim() || '',
    businessPriceIdAud: config.stripeBusinessPriceIdAud?.trim() || '',
    starterAnnualPriceId: config.stripeStarterAnnualPriceId?.trim() || '',
    teamAnnualPriceId: config.stripeTeamAnnualPriceId?.trim() || '',
    businessAnnualPriceId: config.stripeBusinessAnnualPriceId?.trim() || '',
    starterAnnualPriceIdAud: config.stripeStarterAnnualPriceIdAud?.trim() || '',
    teamAnnualPriceIdAud: config.stripeTeamAnnualPriceIdAud?.trim() || '',
    businessAnnualPriceIdAud: config.stripeBusinessAnnualPriceIdAud?.trim() || '',
    selfhostPriceId: config.stripeSelfhostPriceId?.trim() || '',
    selfhostAnnualPriceId: config.stripeSelfhostAnnualPriceId?.trim() || '',
    publishableKey: config.public?.stripePublishableKey?.trim() || '',
    devBypassToken: config.stripeDevBypassToken?.trim() || STRIPE_CHECKOUT_DEV_BYPASS
  }
}

export function isStripeCheckoutConfigured(stripeConfig: StripeServerConfig): boolean {
  return Boolean(
    stripeConfig.secretKey
    && stripeConfig.teamPriceId
    && validateStripePriceId(stripeConfig.teamPriceId) === null
  )
}

export function isStripeAnnualCheckoutConfigured(stripeConfig: StripeServerConfig): boolean {
  return Boolean(
    stripeConfig.secretKey
    && stripeConfig.teamAnnualPriceId
    && validateStripePriceId(stripeConfig.teamAnnualPriceId) === null
  )
}

export function assertStripeCheckoutConfigured(stripeConfig: StripeServerConfig): void {
  if (!isStripeCheckoutConfigured(stripeConfig)) {
    throw new Error(
      'Stripe checkout is not configured. Set NUXT_STRIPE_SECRET_KEY and NUXT_STRIPE_TEAM_PRICE_ID (or NUXT_STRIPE_STANDARD_PRICE_ID).'
    )
  }
}

export function isStripeTestModeSecret(secretKey: string): boolean {
  return secretKey.startsWith('sk_test_')
}

export function isStripeLiveModeSecret(secretKey: string): boolean {
  return secretKey.startsWith('sk_live_')
}

export function validateStripeSecretKey(secretKey: string): string | null {
  if (!secretKey) return null
  if (isStripeTestModeSecret(secretKey) || isStripeLiveModeSecret(secretKey)) {
    return null
  }
  return 'NUXT_STRIPE_SECRET_KEY must start with sk_test_ or sk_live_.'
}

export function validateStripePriceId(priceId: string, envName = 'NUXT_STRIPE_PRICE_ID'): string | null {
  if (!priceId) return null
  if (priceId.startsWith('prod_')) {
    return `${envName} must be a Price ID (price_…), not a Product ID (prod_…).`
  }
  if (!priceId.startsWith('price_')) {
    return `${envName} must start with price_.`
  }
  return null
}

/** @deprecated Use validateStripePriceId */
export function validateStripeStandardPriceId(priceId: string): string | null {
  return validateStripePriceId(priceId, 'NUXT_STRIPE_TEAM_PRICE_ID')
}

export function resolveStripePriceId(
  stripeConfig: StripeServerConfig,
  plan: PaidCheckoutPlan,
  interval: BillingInterval
): string {
  if (interval === 'annual') {
    if (plan === 'starter') return stripeConfig.starterAnnualPriceId
    if (plan === 'team') return stripeConfig.teamAnnualPriceId
    return stripeConfig.businessAnnualPriceId
  }
  if (plan === 'starter') return stripeConfig.starterPriceId
  if (plan === 'team') return stripeConfig.teamPriceId
  return stripeConfig.businessPriceId
}

export function resolvePlanFromStripePriceId(
  stripeConfig: StripeServerConfig,
  priceId: string | null | undefined,
  standardPriceId = ''
): PaidCheckoutPlan | null {
  const normalized = priceId?.trim()
  if (!normalized) return null

  for (const [plan, configured] of [
    ['starter', stripeConfig.starterPriceId],
    ['team', stripeConfig.teamPriceId],
    ['business', stripeConfig.businessPriceId],
    ['starter', stripeConfig.starterAnnualPriceId],
    ['team', stripeConfig.teamAnnualPriceId],
    ['business', stripeConfig.businessAnnualPriceId],
    ['team', standardPriceId]
  ] as Array<[PaidCheckoutPlan, string]>) {
    if (configured?.trim() === normalized) return plan
  }

  return null
}

export function validateCheckoutPlanPrice(
  stripeConfig: StripeServerConfig,
  plan: PaidCheckoutPlan,
  interval: BillingInterval
): string | null {
  const priceId = resolveStripePriceId(stripeConfig, plan, interval)
  const envName = interval === 'annual'
    ? `NUXT_STRIPE_${plan.toUpperCase()}_ANNUAL_PRICE_ID`
    : `NUXT_STRIPE_${plan.toUpperCase()}_PRICE_ID`
  if (!priceId) {
    return `${envName} is not configured.`
  }
  return validateStripePriceId(priceId, envName)
}

export function isStripeSelfHostCheckoutConfigured(stripeConfig: StripeServerConfig): boolean {
  return Boolean(
    stripeConfig.secretKey
    && stripeConfig.selfhostPriceId
    && validateStripePriceId(stripeConfig.selfhostPriceId) === null
  )
}

export function resolveSelfHostStripePriceId(
  stripeConfig: StripeServerConfig,
  interval: BillingInterval
): string {
  if (interval === 'annual') return stripeConfig.selfhostAnnualPriceId
  return stripeConfig.selfhostPriceId
}

export function isSelfHostStripePriceId(
  stripeConfig: StripeServerConfig,
  priceId: string | null | undefined
): boolean {
  const normalized = priceId?.trim()
  if (!normalized) return false
  return normalized === stripeConfig.selfhostPriceId
    || normalized === stripeConfig.selfhostAnnualPriceId
}

export function validateSelfHostCheckoutPrice(
  stripeConfig: StripeServerConfig,
  interval: BillingInterval
): string | null {
  const priceId = resolveSelfHostStripePriceId(stripeConfig, interval)
  const envName = interval === 'annual'
    ? 'NUXT_STRIPE_SELFHOST_ANNUAL_PRICE_ID'
    : 'NUXT_STRIPE_SELFHOST_PRICE_ID'
  if (!priceId) return `${envName} is not configured.`
  return validateStripePriceId(priceId, envName)
}

export function parseCheckoutPlanInput(value: unknown): PaidCheckoutPlan | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'standard') return 'team'
  return isPaidCheckoutPlan(trimmed) ? trimmed : null
}

/** Paid checkout bypass for local dev — blocked in production builds. */
export function isDevCheckoutBypassAllowed(
  event: H3Event,
  checkoutToken: unknown,
  stripeConfig: StripeServerConfig
): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (!isDevCheckoutBypassToken(checkoutToken, stripeConfig.devBypassToken)) {
    return false
  }
  const config = useRuntimeConfig(event)
  const appDomain = config.public.appDomain?.trim().toLowerCase() || 'localhost'
  return appDomain === 'localhost' || appDomain.includes('localhost')
}
