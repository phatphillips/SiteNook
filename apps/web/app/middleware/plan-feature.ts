import type { PlanFeature } from '~/utils/planLimits'
import { planHasFeature } from '~/utils/planLimits'
import { resolveEffectiveOrganizationPlan } from '~/utils/resolveOrgPlan'
import { isCommercialEnabled } from '~/utils/commercial'

export default defineNuxtRouteMiddleware(async (to) => {
  if (!isCommercialEnabled()) return

  const required = to.meta.planFeature as PlanFeature | undefined
  if (!required) return

  // PocketBase auth is client-only; enforce plan gates after hydration.
  if (import.meta.server) return

  const plan = await resolveEffectiveOrganizationPlan()
  if (planHasFeature(plan, required)) return

  const toast = useToast()
  toast.add({
    title: 'Upgrade required',
    description: 'This feature is not included in your current plan.',
    color: 'warning'
  })
  return navigateTo('/settings/billing')
})
