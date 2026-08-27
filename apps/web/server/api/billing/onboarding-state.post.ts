import { createError } from 'h3'
import type { RecordModel } from 'pocketbase'
import type { Organization, OrganizationOnboardingState } from '~/types/sitenook'
import { isOrgAdmin, requireUserOrganizationId } from '~/utils/orgAccess'
import { trackServerFunnelEvent } from '../../utils/funnelAnalytics'

function mergeOnboardingState(
  current: OrganizationOnboardingState | null | undefined,
  patch: Partial<OrganizationOnboardingState>
): OrganizationOnboardingState {
  return {
    dismissed: false,
    siteAdded: false,
    firstScanStarted: false,
    ahaSeen: false,
    teammateInvited: false,
    scheduleEnabled: false,
    ...(current && typeof current === 'object' ? current : {}),
    ...patch
  }
}

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event) as RecordModel
  if (!isOrgAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can update onboarding.' })
  }

  const organizationId = requireUserOrganizationId(user)
  const body = await readBody<{ state?: Partial<OrganizationOnboardingState> }>(event)
  if (!body?.state || typeof body.state !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'state object is required' })
  }

  const pb = await getPbAdmin(event)
  const org = await pb.collection('organizations').getOne<Organization>(organizationId)
  const nextState = mergeOnboardingState(org.onboarding_state, body.state)

  const updated = await pb.collection('organizations').update<Organization>(organizationId, {
    onboarding_state: nextState
  })

  if (body.state.ahaSeen === true && !org.onboarding_state?.ahaSeen) {
    trackServerFunnelEvent('aha_viewed', { organizationId })
  }
  if (body.state.siteAdded === true && !org.onboarding_state?.siteAdded) {
    trackServerFunnelEvent('first_site', { organizationId })
  }
  if (body.state.firstScanStarted === true && !org.onboarding_state?.firstScanStarted) {
    trackServerFunnelEvent('first_scan_complete', { organizationId })
  }

  return { organization: updated, onboarding_state: nextState }
})
