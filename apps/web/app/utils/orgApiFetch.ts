import { FetchError } from 'ofetch'
import { tryRefreshAuthSession } from '~/utils/sessionRefresh'
import { buildLoginNavigation } from '~/utils/authRoute'

function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof FetchError) {
    return error.statusCode === 401
  }
  return false
}

export async function orgApiFetch<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
  requestOptions?: Omit<Parameters<typeof $fetch<T>>[1], 'headers' | 'query'>
): Promise<T> {
  const { pb, awaitAuthReady, syncAuth } = usePocketBase()
  await awaitAuthReady()

  async function requestWithToken(token: string): Promise<T> {
    return $fetch<T>(path, {
      ...requestOptions,
      headers: { Authorization: `Bearer ${token}` },
      query
    })
  }

  let token = pb?.authStore.token
  if (!token) throw new Error('Authentication required')

  try {
    return await requestWithToken(token)
  } catch (error) {
    if (!isUnauthorizedError(error) || !pb) throw error

    const refreshed = await tryRefreshAuthSession(pb, syncAuth)
    if (refreshed && pb.authStore.token) {
      try {
        return await requestWithToken(pb.authStore.token)
      } catch (retryError) {
        if (!isUnauthorizedError(retryError)) throw retryError
      }
    }

    pb.authStore.clear()
    syncAuth()
    const route = useRoute()
    await navigateTo(buildLoginNavigation(route), { replace: true })
    throw new Error('Session expired. Please sign in again.')
  }
}
