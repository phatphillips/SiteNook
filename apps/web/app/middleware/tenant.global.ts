import { getUserOrganizationId } from '~/utils/orgAccess'
import { isUserRecord } from '~/utils/pbAuth'
import { resetAppSessionState } from '~/utils/sessionReset'
import { isMarketingSiteActive } from '~/utils/marketingSite'
import { isProtectedAppRoute, buildLoginNavigation } from '~/utils/authRoute'
import { ensureAuthenticatedForRoute } from '~/utils/ensureAuthenticated'
import {
  AUTH_READY_TIMEOUT_MS,
  TENANT_CONTEXT_TIMEOUT_MS,
  withTimeout
} from '~/utils/fetchTimeout'
import {
  parseTenantOnlyFlag,
  resolveTenantOnlyApexRedirect
} from '~/utils/tenantOnlyApex'

const TENANT_BYPASS_PATHS = new Set(['/account-not-found', '/account-closed'])

export default defineNuxtRouteMiddleware(async (to) => {
  const {
    ready,
    loadError,
    isUnknownTenant,
    isTenantHost,
    isApexHost,
    organization,
    hostLooksLikeUnknownTenant,
    loadTenantContext
  } = useTenantOrg()

  const hostMismatch = hostLooksLikeUnknownTenant()
    && !isUnknownTenant.value
    && !isTenantHost.value
    && !loadError.value

  // Always resolve (or refresh) tenant context. LoadTenantContext no-ops when host is unchanged.
  try {
    await withTimeout(
      loadTenantContext(hostMismatch || !ready.value),
      TENANT_CONTEXT_TIMEOUT_MS,
      'Tenant context'
    )
  } catch {
    if (import.meta.client && hostLooksLikeUnknownTenant() && !TENANT_BYPASS_PATHS.has(to.path)) {
      return navigateTo('/account-not-found', { replace: true })
    }
    // Continue for apex / known hosts so public marketing pages still render.
  }

  if (isUnknownTenant.value && !TENANT_BYPASS_PATHS.has(to.path)) {
    return navigateTo('/account-not-found', { replace: true })
  }

  const config = useRuntimeConfig()
  const tenantOnlyRedirect = resolveTenantOnlyApexRedirect(
    to.path,
    parseTenantOnlyFlag(config.public.tenantOnly),
    isApexHost.value,
    config.public.appDomain,
    isMarketingSiteActive(config.public.marketingSite, config.public.commercialEnabled)
  )
  if (tenantOnlyRedirect) {
    return navigateTo(tenantOnlyRedirect, { replace: true })
  }

  if (import.meta.server || !isTenantHost.value || !organization.value) {
    return
  }

  if (isProtectedAppRoute(to.path)) {
    const authRedirect = await ensureAuthenticatedForRoute(to)
    if (authRedirect) return authRedirect
  }

  const { awaitAuthReady, syncAuth, pb } = usePocketBase()
  try {
    await withTimeout(awaitAuthReady(), AUTH_READY_TIMEOUT_MS, 'Auth initialization')
  } catch {
    // Continue. Org mismatch checks require a loaded client when available.
  }
  syncAuth()

  if (!pb?.authStore.isValid) return

  const record = pb.authStore.record
  if (!isUserRecord(record)) return

  const userOrgId = getUserOrganizationId(record)
  if (!userOrgId || userOrgId !== organization.value.id) {
    resetAppSessionState()
    pb.authStore.clear()
    syncAuth()
    return navigateTo({
      path: '/login',
      query: { error: 'wrong-org' },
      replace: true
    })
  }

  // Organization closure now uses a 30-day retention window; users keep access until purge.
})
