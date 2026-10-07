export default defineNuxtPlugin(() => {
  const {
    loadTenantContext,
    hostLooksLikeUnknownTenant,
    isUnknownTenant,
    isTenantHost
  } = useTenantOrg()

  // Do not block app boot on tenant resolution. Middleware and pages handle loading state.
  void loadTenantContext()
    .then(async () => {
      if (import.meta.client && hostLooksLikeUnknownTenant() && !isUnknownTenant.value && !isTenantHost.value) {
        await loadTenantContext(true)
      }
    })
    .catch(() => {
      // Middleware and pages surface resolution failures.
    })
})
