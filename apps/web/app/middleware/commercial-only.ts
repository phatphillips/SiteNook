import { isCommercialEnabled } from '~/utils/commercial'

/** Settings and pages that only exist when the commercial module is on. */
export default defineNuxtRouteMiddleware(() => {
  if (isCommercialEnabled()) return
  return navigateTo('/settings', { replace: true })
})
