import PocketBase from 'pocketbase'
import { GUEST_AUTH_PATHS, resolveLoginRedirectPath, syncPbAuthState } from '~/utils/pbAuth'
import { attachPocketBaseFetchTimeout, PB_FETCH_TIMEOUT_MS } from '~/utils/fetchTimeout'
import {
  attachPb401Retry,
  createRefreshAuthToken,
  startPeriodicAuthRefresh
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
  const pb = new PocketBase(config.public.pocketbaseUrl)
  pb.autoCancellation(false)

  let navigationAbort = new AbortController()
  const router = useRouter()
  router.beforeEach(() => {
    navigationAbort.abort()
    navigationAbort = new AbortController()
  })

  attachPocketBaseFetchTimeout(pb, PB_FETCH_TIMEOUT_MS, () => navigationAbort.signal)

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

    const redirect = resolveLoginRedirectPath(path + window.location.search, '/')
    void navigateTo({ path: '/login', query: { redirect }, replace: true })
  }

  const refreshAuthToken = createRefreshAuthToken(pb, syncAuth)

  attachPb401Retry(pb, {
    refreshAuthToken,
    onSessionExpired: handleSessionExpired
  })

  const stopPeriodicRefresh = startPeriodicAuthRefresh(pb, refreshAuthToken)

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      stopPeriodicRefresh()
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
