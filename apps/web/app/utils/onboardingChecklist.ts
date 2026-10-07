import type { OrganizationOnboardingState } from '~/types/sitenook'

/** Required milestones before the dashboard checklist auto-hides (dismiss still wins). */
export function isOnboardingChecklistComplete(
  state: Pick<
    OrganizationOnboardingState,
    'siteAdded' | 'firstScanStarted' | 'ahaSeen'
  >
): boolean {
  return Boolean(state.siteAdded)
    && Boolean(state.firstScanStarted)
    && Boolean(state.ahaSeen)
}

/** Whether the dismissable getting-started section should render. */
export function shouldShowOnboardingChecklist(
  state: OrganizationOnboardingState
): boolean {
  if (state.dismissed) return false
  return !isOnboardingChecklistComplete(state)
}
