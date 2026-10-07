import type { RouteLocationNormalized } from 'vue-router'
import { isUserRecord } from '~/utils/pbAuth'
import { AUTH_READY_TIMEOUT_MS, withTimeout } from '~/utils/fetchTimeout'
import { buildLoginNavigation, isProtectedAppRoute } from '~/utils/authRoute'

export async function ensureAuthenticatedForRoute(
  to: Pick<RouteLocationNormalized, 'fullPath' | 'path'>
): Promise<ReturnType<typeof navigateTo> | undefined> {
  if (import.meta.server) return
  if (!isProtectedAppRoute(to.path)) return

  const { awaitAuthReady, syncAuth, pb } = usePocketBase()

  try {
    await withTimeout(awaitAuthReady(), AUTH_READY_TIMEOUT_MS, 'Auth initialization')
  } catch {
    // Plugin did not finish in time. Treat as signed out.
  }

  syncAuth()

  if (!pb) {
    return navigateTo(buildLoginNavigation(to))
  }

  const record = pb.authStore.record
  if (!pb.authStore.isValid || !isUserRecord(record)) {
    return navigateTo(buildLoginNavigation(to))
  }
}
