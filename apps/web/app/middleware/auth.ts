import { ensureAuthenticatedForRoute } from '~/utils/ensureAuthenticated'

export default defineNuxtRouteMiddleware(async (to) => {
  return ensureAuthenticatedForRoute(to)
})
