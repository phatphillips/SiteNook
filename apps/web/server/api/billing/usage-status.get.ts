import { createError } from 'h3'
import type { RecordModel } from 'pocketbase'
import type { Organization } from '~/types/sitenook'
import { loadOrganizationPlanUsage } from '../../utils/orgPlanUsage'
import { isOrgAdmin, requireUserOrganizationId } from '~/utils/orgAccess'
import {
  buildPlanUsageBreakdown,
  summarizeUsageLimits
} from '~/utils/planUsageBreakdown'
import { normalizeOrganizationPlan } from '~/utils/planLimits'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event) as RecordModel
  if (!isOrgAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can view usage status.' })
  }

  const organizationId = requireUserOrganizationId(user)
  const pb = await getPbAdmin(event)
  const org = await pb.collection('organizations').getOne<Organization>(organizationId)
  const usage = await loadOrganizationPlanUsage(pb, organizationId)
  const currentPlan = normalizeOrganizationPlan(org.plan)
  const rows = buildPlanUsageBreakdown(currentPlan, usage)
  const summary = summarizeUsageLimits(rows)

  return {
    plan: currentPlan,
    usage,
    rows,
    status: summary.status,
    hasWarning: summary.hasWarning,
    hasExceeded: summary.hasExceeded,
    messages: summary.messages
  }
})
