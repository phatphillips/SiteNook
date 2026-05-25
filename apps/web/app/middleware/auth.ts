export default defineNuxtRouteMiddleware(() => {
  // PocketBase auth is stored in localStorage — only enforce on the client.
  if (import.meta.server) return

  const { restoreAuth, isAuthenticated, pb } = usePocketBase()
  restoreAuth()

  if (!isAuthenticated.value || !pb.authStore.isValid) {
    return navigateTo('/login')
  }
})
