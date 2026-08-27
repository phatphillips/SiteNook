import type { OrganizationPlan } from '~/types/sitenook'
import { isPaidCheckoutPlan, ORGANIZATION_PLANS } from '~/utils/planLimits'

/** Query token for local dev when Stripe keys are not configured (G0 decision #6). */
export const STRIPE_CHECKOUT_DEV_BYPASS = 'dev_bypass'

export function parseStripeDevBypassFlag(value: unknown): boolean {
  if (value === true) return true
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

export function parseStripeCheckoutConfiguredFlag(value: unknown): boolean {
  return parseStripeDevBypassFlag(value)
}

export function parseStripeAnnualCheckoutConfiguredFlag(value: unknown): boolean {
  return parseStripeDevBypassFlag(value)
}

export function isDevCheckoutBypassToken(
  checkout: unknown,
  expectedToken: string = STRIPE_CHECKOUT_DEV_BYPASS
): boolean {
  if (typeof checkout !== 'string') return false
  return checkout.trim() === expectedToken.trim()
}

export function buildDevBypassStartUrl(plan: OrganizationPlan): string {
  const params = new URLSearchParams({
    checkout: STRIPE_CHECKOUT_DEV_BYPASS,
    plan
  })
  return `/start?${params.toString()}`
}

/** Dev-only bypass for paid-plan funnel testing without Stripe keys. */
export function shouldAllowDevCheckoutBypass(options: {
  isDev: boolean
  devBypassFlag: boolean
  appDomain: string
}): boolean {
  if (!options.devBypassFlag) return false
  if (options.isDev) return true
  return options.appDomain.trim().toLowerCase() === 'localhost'
}

export function parseCheckoutPlan(value: unknown): OrganizationPlan | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'standard') return 'team'
  return ORGANIZATION_PLANS.includes(trimmed as OrganizationPlan) ? trimmed as OrganizationPlan : null
}

export function parsePaidCheckoutPlan(value: unknown): OrganizationPlan | null {
  const plan = parseCheckoutPlan(value)
  if (!plan || !isPaidCheckoutPlan(plan)) return null
  return plan
}

export type BillingInterval = 'monthly' | 'annual'

export function parseBillingInterval(value: unknown): BillingInterval {
  if (typeof value === 'string' && value.trim().toLowerCase() === 'annual') {
    return 'annual'
  }
  return 'monthly'
}
