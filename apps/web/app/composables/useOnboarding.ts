import type { OrganizationOnboardingState } from '~/types/sitenook'
import { daysRemainingUntil } from '~/utils/planPricing'
import { trackFunnelEvent } from '~/utils/funnelAnalytics'
import { canWriteOrg, getUserOrganizationId } from '~/utils/orgAccess'
import { shouldShowOnboardingChecklist } from '~/utils/onboardingChecklist'

type OnboardingOrg = {
  id: string
  onboarding_state?: OrganizationOnboardingState | null
  subscription_status?: string | null
  trial_ends_at?: string | null
}

export function useOnboarding() {
  const { organization, loadTenantContext } = useTenantOrg()
  const { pb, sessionUser } = usePocketBase()
  const saving = ref(false)
  const membershipOrg = ref<OnboardingOrg | null>(null)

  async function loadMembershipOrg(force = false) {
    if (!import.meta.client || !pb) return null
    const orgId = getUserOrganizationId(sessionUser.value)
    if (!orgId) {
      membershipOrg.value = null
      return null
    }
    if (!force && membershipOrg.value?.id === orgId) {
      return membershipOrg.value
    }
    try {
      const record = await pb.collection('organizations').getOne(orgId, {
        fields: 'id,subscription_status,trial_ends_at,onboarding_state'
      }) as OnboardingOrg
      membershipOrg.value = record
      return record
    } catch {
      membershipOrg.value = null
      return null
    }
  }

  watch(
    [sessionUser, organization],
    ([user, tenantOrg]) => {
      if (!user) {
        membershipOrg.value = null
        return
      }
      // Tenant host already exposes onboarding_state via org-context.
      if (tenantOrg?.id) return
      void loadMembershipOrg()
    },
    { immediate: true }
  )

  const effectiveOrganization = computed<OnboardingOrg | null>(() =>
    organization.value || membershipOrg.value
  )

  const onboardingState = computed<OrganizationOnboardingState>(() => ({
    dismissed: false,
    siteAdded: false,
    firstScanStarted: false,
    ahaSeen: false,
    teammateInvited: false,
    scheduleEnabled: false,
    ...(effectiveOrganization.value?.onboarding_state || {})
  }))

  const isTrialing = computed(() =>
    effectiveOrganization.value?.subscription_status === 'trialing'
    && Boolean(effectiveOrganization.value?.trial_ends_at?.trim())
  )

  const trialDaysRemaining = computed(() =>
    daysRemainingUntil(effectiveOrganization.value?.trial_ends_at || null)
  )

  const showChecklist = computed(() => {
    if (!effectiveOrganization.value) return false
    if (!sessionUser.value) return false
    return shouldShowOnboardingChecklist(onboardingState.value)
  })

  async function refreshOnboardingOrg() {
    await Promise.all([
      loadTenantContext(true).catch(() => null),
      loadMembershipOrg(true)
    ])
  }

  async function patchOnboardingState(patch: Partial<OrganizationOnboardingState>) {
    if (!pb?.authStore.token) return null
    saving.value = true
    try {
      const result = await $fetch<{
        onboarding_state: OrganizationOnboardingState
      }>('/api/billing/onboarding-state', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pb.authStore.token}` },
        body: { state: patch }
      })
      await refreshOnboardingOrg()
      return result.onboarding_state
    } finally {
      saving.value = false
    }
  }

  async function markSiteAndScanStarted() {
    trackFunnelEvent('first_site', { organizationId: effectiveOrganization.value?.id })
    trackFunnelEvent('first_scan_complete', { organizationId: effectiveOrganization.value?.id })
    return patchOnboardingState({ siteAdded: true, firstScanStarted: true })
  }

  async function markAhaSeen() {
    trackFunnelEvent('aha_viewed', { organizationId: effectiveOrganization.value?.id })
    return patchOnboardingState({ ahaSeen: true })
  }

  async function dismissChecklist() {
    return patchOnboardingState({ dismissed: true })
  }

  async function markTeammateInvited() {
    return patchOnboardingState({ teammateInvited: true })
  }

  async function markScheduleEnabled() {
    return patchOnboardingState({ scheduleEnabled: true })
  }

  const canManageOnboarding = computed(() => canWriteOrg(sessionUser.value))

  return {
    organization: effectiveOrganization,
    onboardingState,
    isTrialing,
    trialDaysRemaining,
    showChecklist,
    saving,
    canManageOnboarding,
    patchOnboardingState,
    markSiteAndScanStarted,
    markAhaSeen,
    dismissChecklist,
    markTeammateInvited,
    markScheduleEnabled,
    loadMembershipOrg
  }
}
