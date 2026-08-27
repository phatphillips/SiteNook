import { createError } from 'h3'
import type { RecordModel } from 'pocketbase'
import type { Organization } from '~/types/sitenook'
import {
  canUpgradeOrganizationFromFree,
  describeUpgradeIneligibility
} from '../../utils/orgBilling'
import {
  buildCheckoutSessionParams,
  formatStripeCheckoutError
} from '../../utils/stripeCheckoutSession'
import { buildStripeReturnUrl } from '../../utils/stripeReturnUrl'
import { isOrgAdmin, requireUserOrganizationId } from '~/utils/orgAccess'
import { parseBillingInterval } from '~/utils/stripeCheckout'
import {
  assertStripeCheckoutConfigured,
  parseCheckoutPlanInput,
  readStripeServerConfig,
  resolveStripePriceId,
  validateCheckoutPlanPrice,
  validateStripeSecretKey
} from '../../utils/stripeConfig'

interface UpgradeCheckoutBody {
  plan?: string
  interval?: string
}

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event) as RecordModel
  if (!isOrgAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can upgrade billing.' })
  }

  const organizationId = requireUserOrganizationId(user)
  const pb = await getPbAdmin(event)
  const org = await pb.collection('organizations').getOne<Organization>(organizationId)

  if (!canUpgradeOrganizationFromFree(org)) {
    throw createError({
      statusCode: 400,
      statusMessage: describeUpgradeIneligibility(org)
    })
  }

  assertRateLimit(event, `stripe-upgrade-checkout:user:${user.id}`, { max: 10, windowMs: 60 * 60_000 })

  const body = await readBody<UpgradeCheckoutBody>(event)
  const plan = parseCheckoutPlanInput(body?.plan) ?? 'team'
  const interval = parseBillingInterval(body?.interval)

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

  const priceError = validateCheckoutPlanPrice(stripeConfig, plan, interval)
  if (priceError) {
    throw createError({ statusCode: 500, statusMessage: priceError })
  }

  const keyError = validateStripeSecretKey(stripeConfig.secretKey)
  if (keyError) {
    throw createError({ statusCode: 500, statusMessage: keyError })
  }

  const stripe = requireStripeClient(event)
  const successUrl = buildStripeReturnUrl(event, '/settings/billing', { checkout: 'success' })
  const cancelUrl = buildStripeReturnUrl(event, '/settings/billing', { checkout: 'cancelled' })
  const priceId = resolveStripePriceId(stripeConfig, plan, interval)

  try {
    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({
        plan,
        priceId,
        interval,
        successUrl,
        cancelUrl,
        organizationId
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
