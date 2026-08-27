import type { OrganizationPlan } from '~/types/sitenook'
import { normalizeOrganizationPlan } from '~/utils/planLimits'
import { getUserOrganizationId } from '~/utils/orgAccess'
import { AUTH_READY_TIMEOUT_MS, withTimeout } from '~/utils/fetchTimeout'

/** Prefer tenant subdomain org; fall back to the signed-in user's organization (apex / localhost dev). */
export function resolvePlanFromSources(
  tenantOrganization: { plan?: unknown } | null | undefined,
  userOrganization: { plan?: unknown } | null | undefined
): OrganizationPlan {
  const tenantPlan = tenantOrganization?.plan
  if (tenantPlan != null && String(tenantPlan).trim()) {
    return normalizeOrganizationPlan(tenantPlan)
  }
  return normalizeOrganizationPlan(userOrganization?.plan)
}

export async function resolveEffectiveOrganizationPlan(): Promise<OrganizationPlan> {
  const { organization, loadTenantContext, ready } = useTenantOrg()

  if (!ready.value) {
    try {
      await loadTenantContext()
    } catch {
      // Tenant host resolution failed — still try user org below.
    }
  }

  if (organization.value?.plan) {
    return resolvePlanFromSources(organization.value, null)
  }

  const { awaitAuthReady, syncAuth, pb } = usePocketBase()
  try {
    await withTimeout(awaitAuthReady(), AUTH_READY_TIMEOUT_MS, 'Auth initialization')
  } catch {
    return 'free'
  }

  syncAuth()
  const orgId = getUserOrganizationId(pb?.authStore.record)
  if (!orgId || !pb) {
    return 'free'
  }

  try {
    const userOrg = await pb.collection('organizations').getOne(orgId, { fields: 'plan' })
    return resolvePlanFromSources(organization.value, userOrg as { plan?: unknown })
  } catch {
    return 'free'
  }
}
