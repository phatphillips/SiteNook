import type { OrganizationOnboardingState } from '~/types/sitenook'
import { daysRemainingUntil } from '~/utils/planPricing'
import { trackFunnelEvent } from '~/utils/funnelAnalytics'
import { canWriteOrg } from '~/utils/orgAccess'
import { shouldShowOnboardingChecklist } from '~/utils/onboardingChecklist'

export function useOnboarding() {
  const { organization, loadTenantContext } = useTenantOrg()
  const { pb, sessionUser } = usePocketBase()
  const saving = ref(false)

  const onboardingState = computed<OrganizationOnboardingState>(() => ({
    dismissed: false,
    siteAdded: false,
    firstScanStarted: false,
    ahaSeen: false,
    teammateInvited: false,
    scheduleEnabled: false,
    ...(organization.value?.onboarding_state || {})
  }))

  const isTrialing = computed(() =>
    organization.value?.subscription_status === 'trialing'
    && Boolean(organization.value?.trial_ends_at?.trim())
  )

  const trialDaysRemaining = computed(() =>
    daysRemainingUntil(organization.value?.trial_ends_at || null)
  )

  const showChecklist = computed(() => {
    if (!organization.value) return false
    return shouldShowOnboardingChecklist(onboardingState.value)
  })

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
      await loadTenantContext(true)
      return result.onboarding_state
    } finally {
      saving.value = false
    }
  }

  async function markSiteAndScanStarted() {
    trackFunnelEvent('first_site', { organizationId: organization.value?.id })
    trackFunnelEvent('first_scan_complete', { organizationId: organization.value?.id })
    return patchOnboardingState({ siteAdded: true, firstScanStarted: true })
  }

  async function markAhaSeen() {
    trackFunnelEvent('aha_viewed', { organizationId: organization.value?.id })
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
    organization,
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
    markScheduleEnabled
  }
}
