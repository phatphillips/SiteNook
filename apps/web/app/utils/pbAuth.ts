import { ClientResponseError, type RecordModel } from 'pocketbase'
import type PocketBase from 'pocketbase'
import type { Ref } from 'vue'

export function isUserRecord(record: RecordModel | null | undefined): boolean {
  return !!record && (record.collectionName === 'users' || record.collectionId === '_pb_users_auth_')
}

export function syncPbAuthState(
  pb: PocketBase,
  user: Ref<RecordModel | null>,
  isAuthenticated: Ref<boolean>
) {
  const record = pb.authStore.record
  const authed = pb.authStore.isValid && isUserRecord(record)
  isAuthenticated.value = authed
  user.value = authed ? record! : null
}

export function shouldClearAuthOnRefreshError(error: unknown): boolean {
  return error instanceof ClientResponseError
    && (error.status === 401 || error.status === 403)
}

/** Routes where an expired session should not trigger another login redirect. */
export const GUEST_AUTH_PATHS = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password'
])

/** Safe in-app path for post-login redirect (blocks open redirects). */
export function resolveLoginRedirectPath(redirect: unknown, fallback = '/'): string {
  if (typeof redirect !== 'string') return fallback
  const path = redirect.trim()
  if (!path.startsWith('/') || path.startsWith('//')) return fallback
  return path
}
