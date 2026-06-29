import { createError } from 'h3'
import type { RecordModel } from 'pocketbase'
import type { Organization } from '~/types/accessiq'
import { loadOrganizationPlanUsage } from '../../utils/orgPlanUsage'
import { isOrgAdmin, requireUserOrganizationId } from '~/utils/orgAccess'
import { buildPaidPlanChangeAssessments } from '~/utils/planEligibility'
import {
  buildPlanUsageBreakdown,
  summarizeUsageLimits
} from '~/utils/planUsageBreakdown'
import { normalizeOrganizationPlan } from '~/utils/planLimits'
import { getPlanOffering } from '~/utils/planPricing'
import { loadBillingSubscriptionDetails } from '../../utils/billingStripeDetails'
import {
  isStripeAnnualCheckoutConfigured,
  isStripeCheckoutConfigured,
  readStripeServerConfig
} from '../../utils/stripeConfig'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event) as RecordModel
  if (!isOrgAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can view billing.' })
  }

  const organizationId = requireUserOrganizationId(user)
  const pb = await getPbAdmin(event)
  const org = await pb.collection('organizations').getOne<Organization>(organizationId)
  const usage = await loadOrganizationPlanUsage(pb, organizationId)
  const currentPlan = normalizeOrganizationPlan(org.plan)
  const planChanges = buildPaidPlanChangeAssessments(currentPlan, usage)
  const usageRows = buildPlanUsageBreakdown(currentPlan, usage)
  const usageLimits = summarizeUsageLimits(usageRows)

  const config = useRuntimeConfig(event)
  const stripeConfig = readStripeServerConfig(config)
  const stripeCheckoutConfigured = isStripeCheckoutConfigured(stripeConfig)

  let subscription: Awaited<ReturnType<typeof loadBillingSubscriptionDetails>> = null
  if (stripeCheckoutConfigured && org.stripe_customer_id?.trim()) {
    try {
      const stripe = requireStripeClient(event)
      subscription = await loadBillingSubscriptionDetails(stripe, org)
    } catch (error) {
      console.error('[billing/summary] subscription details', error)
    }
  }

  return {
    organization: org,
    usage,
    usageRows,
    usageLimits,
    currentPlan,
    currentPlanLabel: getPlanOffering(currentPlan)?.name ?? currentPlan,
    planChanges,
    subscription,
    stripeCheckoutConfigured,
    annualCheckoutConfigured: isStripeAnnualCheckoutConfigured(stripeConfig)
  }
})
