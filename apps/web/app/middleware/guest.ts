import { resolveLoginRedirectPath } from '~/utils/pbAuth'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  setPageLayout(false)

  const { awaitAuthReady, syncAuth, isAuthenticated } = usePocketBase()
  await awaitAuthReady()
  syncAuth()

  if (isAuthenticated.value) {
    const path = to.path === '/login'
      ? resolveLoginRedirectPath(to.query.redirect)
      : '/'
    return navigateTo(path, { replace: true })
  }
})
