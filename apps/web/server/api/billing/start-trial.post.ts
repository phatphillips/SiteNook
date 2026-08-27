import { createError } from 'h3'
import type { RecordModel } from 'pocketbase'
import type { Organization } from '~/types/sitenook'
import { isOrgAdmin, requireUserOrganizationId } from '~/utils/orgAccess'
import { normalizeOrganizationPlan } from '~/utils/planLimits'
import { buildTeamTrialProvisionFields, isAppManagedTrial } from '../../utils/teamTrial'
import { hasActiveStripeSubscription, isOrganizationClosing } from '../../utils/orgBilling'
import { trackServerFunnelEvent } from '../../utils/funnelAnalytics'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event) as RecordModel
  if (!isOrgAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can start a trial.' })
  }

  assertRateLimit(event, `start-trial:user:${user.id}`, { max: 5, windowMs: 24 * 60 * 60_000 })

  const organizationId = requireUserOrganizationId(user)
  const pb = await getPbAdmin(event)
  const org = await pb.collection('organizations').getOne<Organization>(organizationId)

  if (isOrganizationClosing(org)) {
    throw createError({ statusCode: 400, statusMessage: 'This organization is closing and cannot start a trial.' })
  }

  if (org.stripe_subscription_id?.trim() && hasActiveStripeSubscription(org)) {
    throw createError({ statusCode: 400, statusMessage: 'This organization already has an active Stripe subscription.' })
  }

  if (isAppManagedTrial(org)) {
    throw createError({ statusCode: 400, statusMessage: 'A Team trial is already active for this organization.' })
  }

  if (org.trial_nudge_stage === -1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This organization has already used its free Team trial. Upgrade from Billing instead.'
    })
  }

  const plan = normalizeOrganizationPlan(org.plan)
  if (plan !== 'free') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only Free organizations can start a Team trial. Choose a paid plan from Billing instead.'
    })
  }

  const updated = await pb.collection('organizations').update<Organization>(
    organizationId,
    buildTeamTrialProvisionFields()
  )

  trackServerFunnelEvent('trial_start', {
    organizationId,
    plan: 'team',
    source: 'in_app'
  })

  return { organization: updated }
})
