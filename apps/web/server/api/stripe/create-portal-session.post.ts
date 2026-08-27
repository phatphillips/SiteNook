import { createError } from 'h3'
import type { RecordModel } from 'pocketbase'
import type { Organization } from '~/types/sitenook'
import { isOrgAdmin, requireUserOrganizationId } from '~/utils/orgAccess'
import { buildStripeReturnUrl } from '../../utils/stripeReturnUrl'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event) as RecordModel
  if (!isOrgAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can manage billing.' })
  }

  const organizationId = requireUserOrganizationId(user)
  const pb = await getPbAdmin(event)
  const org = await pb.collection('organizations').getOne<Organization>(organizationId)

  const customerId = String(org.stripe_customer_id || '').trim()
  if (!customerId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No Stripe billing account is linked to this organization.'
    })
  }

  assertRateLimit(event, `stripe-portal:user:${user.id}`, { max: 10, windowMs: 60 * 60_000 })

  const config = useRuntimeConfig(event)
  const stripeConfig = readStripeServerConfig(config)
  assertStripeCheckoutConfigured(stripeConfig)

  const stripe = requireStripeClient(event)
  const returnUrl = buildStripeReturnUrl(event, '/settings/billing', { portal: 'returned' })

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    })

    if (!session.url) {
      throw createError({ statusCode: 502, statusMessage: 'Stripe did not return a portal URL.' })
    }

    return { url: session.url }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not open the billing portal. Please try again.'
    })
  }
})
