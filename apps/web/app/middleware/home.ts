import { isUserRecord } from '~/utils/pbAuth'
import { parseMarketingSiteFlag } from '~/utils/marketingSite'
import { buildLoginNavigation } from '~/utils/authRoute'

export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig()
  const { isApexHost, loadTenantContext, ready } = useTenantOrg()

  if (!ready.value) {
    try {
      await loadTenantContext()
    } catch {
      // fall through
    }
  }

  const marketingApex = parseMarketingSiteFlag(config.public.marketingSite) && isApexHost.value

  if (!marketingApex) {
    if (import.meta.server) return

    const { awaitAuthReady, syncAuth, pb } = usePocketBase()
    await awaitAuthReady()
    syncAuth()

    if (!pb) {
      return navigateTo(buildLoginNavigation(to))
    }

    const record = pb.authStore.record
    if (!pb.authStore.isValid || !isUserRecord(record)) {
      return navigateTo(buildLoginNavigation(to))
    }

    setPageLayout('default')
    return
  }

  if (import.meta.server) {
    to.meta.marketingLanding = true
    setPageLayout('marketing')
    return
  }

  const { awaitAuthReady, syncAuth, pb } = usePocketBase()
  await awaitAuthReady()
  syncAuth()

  const record = pb?.authStore.record
  if (pb?.authStore.isValid && isUserRecord(record)) {
    setPageLayout('default')
    return
  }

  to.meta.marketingLanding = true
  setPageLayout('marketing')
})
