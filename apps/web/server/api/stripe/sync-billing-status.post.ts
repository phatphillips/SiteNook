import { createError } from 'h3'
import type { RecordModel } from 'pocketbase'
import type { Organization } from '~/types/accessiq'
import { syncStripeOrganizationBilling, refreshStripeOrganizationBilling } from '../../utils/syncStripeBilling'
import { isOrgAdmin, requireUserOrganizationId } from '~/utils/orgAccess'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event) as RecordModel
  if (!isOrgAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can sync billing status.' })
  }

  const organizationId = requireUserOrganizationId(user)
  const pb = await getPbAdmin(event)
  const org = await pb.collection('organizations').getOne<Organization>(organizationId)

  let stripe
  try {
    stripe = requireStripeClient(event)
  } catch (error) {
    throw createError({
      statusCode: 503,
      statusMessage: error instanceof Error ? error.message : 'Stripe is not configured.'
    })
  }

  assertRateLimit(event, `stripe-sync-billing:user:${user.id}`, { max: 30, windowMs: 60 * 60_000 })

  try {
    const result = await refreshStripeOrganizationBilling(pb, stripe, org, event)
    return {
      organization: result.organization,
      retentionStarted: result.retentionStarted,
      closureStarted: result.retentionStarted,
      emailsSent: result.emailsSent,
      emailError: result.emailError,
      stripeStatus: result.stripeStatus,
      cancelAtPeriodEnd: result.cancelAtPeriodEnd,
      stripeSubscriptionId: result.stripeSubscriptionId
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('[stripe/sync-billing-status]', error)
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not sync billing status from Stripe.'
    })
  }
})
