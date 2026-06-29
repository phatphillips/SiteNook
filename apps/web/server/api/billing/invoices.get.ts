import { createError } from 'h3'
import type { RecordModel } from 'pocketbase'
import type { Organization } from '~/types/accessiq'
import { isOrgAdmin, requireUserOrganizationId } from '~/utils/orgAccess'
import { loadBillingInvoices } from '../../utils/billingStripeDetails'
import { readStripeServerConfig, isStripeCheckoutConfigured } from '../../utils/stripeConfig'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event) as RecordModel
  if (!isOrgAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can view invoices.' })
  }

  const organizationId = requireUserOrganizationId(user)
  const pb = await getPbAdmin(event)
  const org = await pb.collection('organizations').getOne<Organization>(organizationId)

  const customerId = String(org.stripe_customer_id || '').trim()
  if (!customerId) {
    return { invoices: [], stripeConfigured: false }
  }

  const config = useRuntimeConfig(event)
  const stripeConfig = readStripeServerConfig(config)
  if (!isStripeCheckoutConfigured(stripeConfig)) {
    return { invoices: [], stripeConfigured: false }
  }

  assertRateLimit(event, `billing-invoices:user:${user.id}`, { max: 30, windowMs: 60 * 60_000 })

  try {
    const stripe = requireStripeClient(event)
    const invoices = await loadBillingInvoices(stripe, customerId)
    return { invoices, stripeConfigured: true }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('[billing/invoices]', error)
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not load invoices from Stripe.'
    })
  }
})
