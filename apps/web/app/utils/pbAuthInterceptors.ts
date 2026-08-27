import { ClientResponseError } from 'pocketbase'
import type PocketBase from 'pocketbase'
import { shouldClearAuthOnRefreshError } from '~/utils/pbAuth'
import { PB_FETCH_TIMEOUT_MS, withTimeout } from '~/utils/fetchTimeout'

/** Background refresh interval for long-lived tabs (5 minutes). */
export const PERIODIC_AUTH_REFRESH_MS = 5 * 60 * 1000

const AUTH_REQUEST_PATH = /\/auth-(?:with-password|refresh|with-oauth2|with-otp|methods)|\/request-(?:password-reset|verification|email-change)|\/confirm-(?:password-reset|verification|email-change)/

type PbClient = PocketBase & {
  send: (url: string, options?: Record<string, unknown>) => Promise<unknown>
}

export function isAuthRelatedRequest(url: string): boolean {
  return AUTH_REQUEST_PATH.test(url)
}

export function shouldRetryOn401(error: unknown, url: string): boolean {
  return error instanceof ClientResponseError
    && error.status === 401
    && !isAuthRelatedRequest(url)
}

export type PbAuthInterceptorHandlers = {
  refreshAuthToken: () => Promise<boolean>
  onSessionExpired: () => void
}

/**
 * On 401, refresh the session once and retry the original PocketBase request.
 * Concurrent 401s share a single in-flight refresh.
 */
export function attachPb401Retry(pb: PocketBase, handlers: PbAuthInterceptorHandlers): void {
  const client = pb as PbClient
  const originalSend = client.send.bind(client)
  let refreshInFlight: Promise<boolean> | null = null

  async function refreshOnce(): Promise<boolean> {
    if (!refreshInFlight) {
      refreshInFlight = handlers.refreshAuthToken().finally(() => {
        refreshInFlight = null
      })
    }
    return refreshInFlight
  }

  client.send = async (url: string, options: Record<string, unknown> = {}) => {
    const isRetry = Boolean(options.__pbAuthRetry)

    try {
      return await originalSend(url, options)
    } catch (error) {
      if (isRetry || !shouldRetryOn401(error, url)) {
        throw error
      }

      const refreshed = await refreshOnce()
      if (!refreshed) {
        handlers.onSessionExpired()
        throw error
      }

      return originalSend(url, { ...options, __pbAuthRetry: true })
    }
  }
}

export function createRefreshAuthToken(
  pb: PocketBase,
  syncAuth: () => void
): () => Promise<boolean> {
  return async () => {
    if (!pb.authStore.isValid) return false
    try {
      await withTimeout(
        pb.collection('users').authRefresh(),
        PB_FETCH_TIMEOUT_MS,
        'Session refresh'
      )
      syncAuth()
      return true
    } catch (error) {
      if (shouldClearAuthOnRefreshError(error)) {
        pb.authStore.clear()
        syncAuth()
      }
      return false
    }
  }
}

export function startPeriodicAuthRefresh(
  pb: PocketBase,
  refreshAuthToken: () => Promise<boolean>
): () => void {
  const intervalId = window.setInterval(() => {
    if (!pb.authStore.isValid) return
    void refreshAuthToken()
  }, PERIODIC_AUTH_REFRESH_MS)

  return () => window.clearInterval(intervalId)
}

/** Refresh when the tab becomes visible again (browsers throttle timers in background tabs). */
export function startVisibilityAuthRefresh(
  pb: PocketBase,
  refreshAuthToken: () => Promise<boolean>,
  onSessionExpired: () => void
): () => void {
  const handler = () => {
    if (document.visibilityState !== 'visible') return
    if (!pb.authStore.isValid) {
      onSessionExpired()
      return
    }
    void refreshAuthToken().then((refreshed) => {
      if (!refreshed && !pb.authStore.isValid) {
        onSessionExpired()
      }
    })
  }

  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}
