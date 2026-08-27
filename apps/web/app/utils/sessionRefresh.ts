import type PocketBase from 'pocketbase'
import { createRefreshAuthToken } from '~/utils/pbAuthInterceptors'

/** Refresh the PocketBase user session (shared by SDK interceptors and org API fetch). */
export function tryRefreshAuthSession(
  pb: PocketBase,
  syncAuth: () => void
): Promise<boolean> {
  return createRefreshAuthToken(pb, syncAuth)()
}
