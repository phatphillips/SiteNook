export default defineNuxtRouteMiddleware(async () => {
  const { ready, isTenantHost, loadTenantContext } = useTenantOrg()

  if (!ready.value) {
    try {
      await loadTenantContext()
    } catch {
      return
    }
  }

  if (isTenantHost.value) {
    return navigateTo('/login', { replace: true })
  }
})
