import { isUserRecord } from '~/utils/pbAuth'
import { parseMarketingSiteFlag } from '~/utils/marketingSite'

/**
 * Public marketing content pages (blog, docs, product, pricing, etc.).
 * Only available on the marketing apex; guests get the marketing layout.
 */
export default defineNuxtRouteMiddleware(async () => {
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
    return navigateTo('/', { replace: true })
  }

  if (import.meta.server) {
    setPageLayout('marketing')
    return
  }

  const { awaitAuthReady, syncAuth, pb } = usePocketBase()
  await awaitAuthReady()
  syncAuth()

  const record = pb?.authStore.record
  if (pb?.authStore.isValid && isUserRecord(record)) {
    return navigateTo('/', { replace: true })
  }

  setPageLayout('marketing')
})
