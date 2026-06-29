import { createError } from 'h3'
import type { RecordModel } from 'pocketbase'
import type { Organization } from '~/types/accessiq'
import { loadOrganizationPlanUsage } from '../../utils/orgPlanUsage'
import {
  canResubscribeOrganization,
  hasActiveStripeSubscription,
  shouldUseCheckoutForPlanChange,
  syncOrganizationSubscription,
  tryWriteOrgActivityLog
} from '../../utils/orgBilling'
import { resolveOrganizationBillingCurrency } from '../../utils/stripeBillingCurrency'
import {
  buildCheckoutSessionParams,
  formatStripeCheckoutError
} from '../../utils/stripeCheckoutSession'
import {
  assertStripePriceMatchesCurrency,
  resolveStripePriceEnvName,
  resolveStripePriceIdForCurrency,
  validateCheckoutPlanPriceForCurrency
} from '../../utils/stripePriceCurrency'
import { changeActiveSubscriptionPlan } from '../../utils/subscriptionPlanChange'
import { buildStripeReturnUrl } from '../../utils/stripeReturnUrl'
import { isOrgAdmin, requireUserOrganizationId } from '~/utils/orgAccess'
import { parseBillingInterval } from '~/utils/stripeCheckout'
import { assessPlanChange } from '~/utils/planEligibility'
import { normalizeOrganizationPlan, type PaidCheckoutPlan } from '~/utils/planLimits'
import {
  assertStripeCheckoutConfigured,
  parseCheckoutPlanInput,
  readStripeServerConfig,
  validateStripeSecretKey
} from '../../utils/stripeConfig'

function resolveCheckoutInterval(
  stripeConfig: ReturnType<typeof readStripeServerConfig>,
  plan: PaidCheckoutPlan,
  requested: ReturnType<typeof parseBillingInterval>,
  currency: string
): ReturnType<typeof parseBillingInterval> {
  if (requested === 'monthly') return 'monthly'
  const annualError = validateCheckoutPlanPriceForCurrency(stripeConfig, plan, 'annual', currency)
  return annualError ? 'monthly' : 'annual'
}

function toHttpError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    return error
  }
  const message = error instanceof Error && error.message
    ? error.message
    : fallback
  return createError({ statusCode: 502, statusMessage: message })
}

interface ChangePlanBody {
  plan?: string
  interval?: string
}

export default defineEventHandler(async (event) => {
  try {
    const user = await requirePbUser(event) as RecordModel
    if (!isOrgAdmin(user)) {
      throw createError({ statusCode: 403, statusMessage: 'Only organization admins can change billing plans.' })
    }

    const organizationId = requireUserOrganizationId(user)
    const pb = await getPbAdmin(event)
    const org = await pb.collection('organizations').getOne<Organization>(organizationId)

    if (org.status === 'closing') {
      throw createError({ statusCode: 400, statusMessage: 'This organization is closing and cannot change plans.' })
    }

    const body = await readBody<ChangePlanBody>(event)
    const targetPlan = parseCheckoutPlanInput(body?.plan)
    if (!targetPlan) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Choose a paid plan (starter, team, or business).'
      })
    }

    const currentPlan = normalizeOrganizationPlan(org.plan)
    const usage = await loadOrganizationPlanUsage(pb, organizationId)
    const assessment = assessPlanChange(currentPlan, targetPlan, usage)
    const resubscribe = canResubscribeOrganization(org)

    if (!resubscribe && assessment.direction === 'same') {
      throw createError({ statusCode: 400, statusMessage: 'Your organization is already on this plan.' })
    }

    if (assessment.direction === 'downgrade' && !assessment.eligible) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Your account exceeds the limits of the target plan. Resolve the items below before downgrading.',
        data: { blockers: assessment.blockers }
      })
    }

    assertRateLimit(event, `stripe-change-plan:user:${user.id}`, { max: 15, windowMs: 60 * 60_000 })

    const config = useRuntimeConfig(event)
    const stripeConfig = readStripeServerConfig(config)
    try {
      assertStripeCheckoutConfigured(stripeConfig)
    } catch (error) {
      throw createError({
        statusCode: 503,
        statusMessage: error instanceof Error ? error.message : 'Stripe checkout is not configured.'
      })
    }

    const keyError = validateStripeSecretKey(stripeConfig.secretKey)
    if (keyError) {
      throw createError({ statusCode: 500, statusMessage: keyError })
    }

    const stripe = requireStripeClient(event)
    const useCheckout = resubscribe || shouldUseCheckoutForPlanChange(org)
    // For fresh checkout/resubscribe, use the app's global price set (USD by default)
    // instead of inheriting legacy customer/subscription currency.
    const billingCurrency = useCheckout
      ? 'usd'
      : await resolveOrganizationBillingCurrency(stripe, org)
    const interval = resolveCheckoutInterval(
      stripeConfig,
      targetPlan,
      parseBillingInterval(body?.interval),
      billingCurrency
    )

    const priceError = validateCheckoutPlanPriceForCurrency(
      stripeConfig,
      targetPlan,
      interval,
      billingCurrency
    )
    if (priceError) {
      throw createError({ statusCode: 400, statusMessage: priceError })
    }

    const priceId = resolveStripePriceIdForCurrency(
      stripeConfig,
      targetPlan,
      interval,
      billingCurrency
    )
    const envHint = `Set ${resolveStripePriceEnvName(targetPlan, interval, billingCurrency)} to a ${billingCurrency.toUpperCase()} price in Stripe.`

    await assertStripePriceMatchesCurrency(stripe, priceId, billingCurrency, envHint)

    if (useCheckout) {
      const successUrl = buildStripeReturnUrl(event, '/settings/billing', { checkout: 'success' })
      const cancelUrl = buildStripeReturnUrl(event, '/settings/billing', { checkout: 'cancelled' })
      try {
        const session = await stripe.checkout.sessions.create(
          buildCheckoutSessionParams({
            plan: targetPlan,
            priceId,
            interval,
            successUrl,
            cancelUrl,
            organizationId,
            // Do not pin to an existing customer here; this allows clean resubscribe
            // when legacy billing data used a different currency.
            customerId: undefined
          })
        )
        if (!session.url) {
          throw createError({ statusCode: 502, statusMessage: 'Stripe did not return a checkout URL.' })
        }
        return { mode: 'checkout', url: session.url, sessionId: session.id }
      } catch (error) {
        throw toHttpError(error, formatStripeCheckoutError(error))
      }
    }

    const customerId = org.stripe_customer_id?.trim()
    const subscriptionId = org.stripe_subscription_id?.trim()
    if (!customerId || !subscriptionId || !hasActiveStripeSubscription(org)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Billing is out of sync with Stripe. Click Refresh billing status, or use Manage billing to fix your subscription.'
      })
    }

    try {
      const { priceChanged } = await changeActiveSubscriptionPlan(
        stripe,
        subscriptionId,
        priceId,
        targetPlan,
        interval,
        billingCurrency
      )

      await syncOrganizationSubscription(pb, org, {
        plan: targetPlan,
        subscriptionStatus: 'active'
      })

      await tryWriteOrgActivityLog(pb, {
        organizationId,
        actorId: user.id,
        action: 'subscription_updated',
        details: {
          plan: targetPlan,
          direction: assessment.direction,
          priceChanged,
          source: 'change-plan'
        }
      })

      const updatedOrg = await pb.collection('organizations').getOne<Organization>(organizationId)
      return { mode: 'updated', plan: targetPlan, organization: updatedOrg }
    } catch (error) {
      throw toHttpError(error, formatStripeCheckoutError(error))
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('[stripe/change-plan]', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Could not change plan.'
    })
  }
})
