import { isUserRecord } from '~/utils/pbAuth'
import { isMarketingSiteActive } from '~/utils/marketingSite'

/**
 * Public marketing content pages (blog, docs, product, pricing, etc.).
 * Only on the paid marketing apex; guests get the marketing layout.
 * See docs/oss-launch-surface.md
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

  const marketingApex = isMarketingSiteActive(
    config.public.marketingSite,
    config.public.commercialEnabled
  ) && isApexHost.value

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
