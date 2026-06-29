import type { H3Event } from 'h3'
import { createError } from 'h3'
import type { OrganizationPlan } from '~/types/accessiq'
import {
  isDevCheckoutBypassToken,
  parseCheckoutPlan,
  parsePaidCheckoutPlan
} from '~/utils/stripeCheckout'
import {
  buildPaidCheckoutUpsertInput,
  isStoredCheckoutSessionValid
} from './stripeCheckoutRecord'
import {
  findValidPaidCheckoutSession,
  upsertPaidCheckoutSession
} from './stripeCheckoutStore'
import { isDevCheckoutBypassAllowed, readStripeServerConfig } from './stripeConfig'

export type StartAccessIntent
  = | { kind: 'free' }
    | { kind: 'paid_checkout', sessionId: string, plan: OrganizationPlan }
    | { kind: 'dev_bypass', plan: OrganizationPlan }
    | { kind: 'deny', redirectTo: string, message: string }

export interface StartAccessGrant {
  allowed: true
  plan: OrganizationPlan
  checkoutSessionId?: string
  customerEmail?: string
  devBypass?: boolean
}

export interface StartAccessDeny {
  allowed: false
  redirectTo: string
  message: string
}

export type StartAccessResult = StartAccessGrant | StartAccessDeny

export function parseStartAccessIntent(
  query: { plan?: unknown, checkout?: unknown },
  options: { devBypassAllowed: boolean }
): StartAccessIntent {
  const plan = parseCheckoutPlan(query.plan)
  const checkout = typeof query.checkout === 'string' ? query.checkout.trim() : ''

  if (plan === 'free') {
    return { kind: 'free' }
  }

  if (plan === 'enterprise') {
    return {
      kind: 'deny',
      redirectTo: '/pricing',
      message: 'Enterprise plans are arranged via sales. Choose another plan or contact us.'
    }
  }

  const paidPlan = parsePaidCheckoutPlan(plan)
  if (isDevCheckoutBypassToken(checkout)) {
    if (!options.devBypassAllowed) {
      return {
        kind: 'deny',
        redirectTo: '/pricing',
        message: 'Payment confirmation is required before creating an organization.'
      }
    }
    if (!paidPlan) {
      return {
        kind: 'deny',
        redirectTo: '/pricing',
        message: 'Choose a paid plan before continuing.'
      }
    }
    return { kind: 'dev_bypass', plan: paidPlan }
  }

  if (checkout.startsWith('cs_')) {
    if (!paidPlan) {
      return {
        kind: 'deny',
        redirectTo: '/pricing',
        message: 'This checkout session does not match the selected plan.'
      }
    }
    return { kind: 'paid_checkout', sessionId: checkout, plan: paidPlan }
  }

  if (paidPlan) {
    return {
      kind: 'deny',
      redirectTo: '/pricing',
      message: `Complete Stripe checkout for the ${paidPlan} plan before continuing.`
    }
  }

  if (!plan && !checkout) {
    return {
      kind: 'deny',
      redirectTo: '/pricing',
      message: 'Choose a plan to get started.'
    }
  }

  return {
    kind: 'deny',
    redirectTo: '/pricing',
    message: 'Invalid signup link. Choose a plan to continue.'
  }
}

export async function resolveStartAccess(
  event: H3Event,
  query: { plan?: unknown, checkout?: unknown }
): Promise<StartAccessResult> {
  const config = useRuntimeConfig(event)
  const stripeConfig = readStripeServerConfig(config)
  const checkoutToken = typeof query.checkout === 'string' ? query.checkout.trim() : ''
  const devBypassAllowed = isDevCheckoutBypassToken(checkoutToken)
    && isDevCheckoutBypassAllowed(event, checkoutToken, stripeConfig)

  const intent = parseStartAccessIntent(query, { devBypassAllowed })

  if (intent.kind === 'deny') {
    return {
      allowed: false,
      redirectTo: intent.redirectTo,
      message: intent.message
    }
  }

  if (intent.kind === 'free') {
    return { allowed: true, plan: 'free' }
  }

  if (intent.kind === 'dev_bypass') {
    return {
      allowed: true,
      plan: intent.plan,
      devBypass: true
    }
  }

  const pb = await getPbAdmin(event)
  let record = await findValidPaidCheckoutSession(pb, intent.sessionId, intent.plan)

  if (!record) {
    const stripe = getStripeClient(event)
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.retrieve(intent.sessionId)
        const upsertInput = buildPaidCheckoutUpsertInput(session)
        if (upsertInput && upsertInput.plan === intent.plan) {
          const upserted = await upsertPaidCheckoutSession(pb, upsertInput)
          if (isStoredCheckoutSessionValid(upserted)) {
            record = upserted
          }
        }
      } catch {
        // fall through to deny
      }
    }
  }

  if (!record) {
    return {
      allowed: false,
      redirectTo: '/pricing?checkout=invalid',
      message: 'We could not verify your payment yet. Wait a moment and try again, or restart checkout from pricing.'
    }
  }

  return {
    allowed: true,
    plan: record.plan,
    checkoutSessionId: record.session_id,
    customerEmail: record.customer_email || undefined
  }
}

/** Server-side gate for POST /api/signup-organization (G6). */
export async function assertSignupPlanAuthorized(
  event: H3Event,
  planValue: unknown,
  checkoutSessionIdValue: unknown
): Promise<{ plan: OrganizationPlan, checkoutSessionId?: string }> {
  const access = await resolveStartAccess(event, {
    plan: planValue,
    checkout: checkoutSessionIdValue
  })

  if (!access.allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: access.message
    })
  }

  return {
    plan: access.plan,
    checkoutSessionId: access.checkoutSessionId
  }
}
