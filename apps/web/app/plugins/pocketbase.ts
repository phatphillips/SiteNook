import PocketBase from 'pocketbase'
import { GUEST_AUTH_PATHS, resolveLoginRedirectPath, syncPbAuthState } from '~/utils/pbAuth'
import { isAnonymousMarketingPath } from '~/utils/marketingSite'
import { attachPocketBaseFetchTimeout, PB_FETCH_TIMEOUT_MS } from '~/utils/fetchTimeout'
import { normalizePublicPocketBaseUrl } from '~/utils/normalizePublicPocketBaseUrl'
import {
  attachPb401Retry,
  createRefreshAuthToken,
  startPeriodicAuthRefresh,
  startVisibilityAuthRefresh
} from '~/utils/pbAuthInterceptors'

export default defineNuxtPlugin({
  name: 'pocketbase',
  setup(nuxtApp) {
  const user = useState<import('pocketbase').RecordModel | null>('pb-user', () => null)
  const isAuthenticated = useState('pb-authenticated', () => false)
  const authReady = useState('pb-auth-ready', () => false)

  if (import.meta.server) {
    nuxtApp.provide('pb', null)
    nuxtApp.provide('authReady', Promise.resolve())
    return
  }

  const config = useRuntimeConfig()
  // Same-origin behind nginx: empty base → browser origin; SDK still calls /api/...
  const pbBase = normalizePublicPocketBaseUrl(String(config.public.pocketbaseUrl || ''))
    || window.location.origin
  const pb = new PocketBase(pbBase)
  pb.autoCancellation(false)

  attachPocketBaseFetchTimeout(pb, PB_FETCH_TIMEOUT_MS)

  nuxtApp.provide('pb', pb)

  let authReadyResolve!: () => void
  const authReadyPromise = new Promise<void>((resolve) => {
    authReadyResolve = resolve
  })

  function syncAuth() {
    syncPbAuthState(pb, user, isAuthenticated)
  }

  function markAuthReady() {
    if (authReady.value) return
    authReady.value = true
    authReadyResolve()
  }

  function handleSessionExpired() {
    pb.authStore.clear()
    syncAuth()

    const path = window.location.pathname
    if (GUEST_AUTH_PATHS.has(path)) return
    // Marketing landing/pricing must remain public even when a stale token expires.
    if (isAnonymousMarketingPath(path, config.public.marketingSite, config.public.commercialEnabled)) return

    const redirect = resolveLoginRedirectPath(path + window.location.search, '/')
    void navigateTo({ path: '/login', query: { redirect }, replace: true })
  }

  const refreshAuthToken = createRefreshAuthToken(pb, syncAuth)

  attachPb401Retry(pb, {
    refreshAuthToken,
    onSessionExpired: handleSessionExpired
  })

  const stopPeriodicRefresh = startPeriodicAuthRefresh(pb, refreshAuthToken)
  const stopVisibilityRefresh = startVisibilityAuthRefresh(pb, refreshAuthToken, handleSessionExpired)

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      stopPeriodicRefresh()
      stopVisibilityRefresh()
    })
  }

  async function restoreAuth() {
    // Trust the persisted token immediately so the UI does not sit in a logged-out state
    // while a background refresh runs.
    syncAuth()
    markAuthReady()

    if (!pb.authStore.isValid) return

    void refreshAuthToken().then((refreshed) => {
      // Redirect only when refresh cleared an invalid/expired session — not on transient network errors.
      if (!refreshed && !pb.authStore.isValid) {
        handleSessionExpired()
      }
    })
  }

  pb.authStore.onChange(syncAuth, true)
  void restoreAuth()

  nuxtApp.provide('authReady', authReadyPromise)
  }
})
