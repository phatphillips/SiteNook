import { ensureAuthenticatedForRoute } from '~/utils/ensureAuthenticated'
import { isProtectedAppRoute } from '~/utils/authRoute'

/**
 * Nuxt may run route middleware on the server (where PocketBase auth is unavailable)
 * without re-running it on client hydration. This plugin re-checks protected deep links
 * on first client load and on every navigation.
 */
export default defineNuxtPlugin({
  name: 'auth-guard',
  dependsOn: ['pocketbase'],
  setup() {
  const router = useRouter()

  async function guard(to = router.currentRoute.value) {
    if (!isProtectedAppRoute(to.path)) return
    return await ensureAuthenticatedForRoute(to)
  }

  router.isReady().then(async () => {
    const redirect = await guard()
    if (redirect) return navigateTo(redirect)
  }).catch(() => {})

  router.beforeEach(async (to) => {
    return await guard(to)
  })
  }
})
