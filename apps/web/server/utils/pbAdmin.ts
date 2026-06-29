import PocketBase from 'pocketbase'
import { createError, type H3Event } from 'h3'
import { attachPocketBaseFetchTimeout, withTimeout, PB_FETCH_TIMEOUT_MS } from '~/utils/fetchTimeout'

let cachedClient: PocketBase | null = null
let authInFlight: Promise<void> | null = null

export function resolveServerPbUrl(event?: H3Event): string {
  const config = useRuntimeConfig(event)
  const serverUrl = config.pocketbaseUrl?.trim()
  if (serverUrl) return serverUrl

  const publicUrl = config.public.pocketbaseUrl?.trim()
  if (publicUrl && /^https?:\/\//i.test(publicUrl)) {
    return publicUrl
  }

  throw createError({
    statusCode: 503,
    statusMessage: 'Server PocketBase URL is not configured (set NUXT_POCKETBASE_URL)'
  })
}

/** PocketBase superuser client for server-only lookups (tenant resolution, provisioning). */
export async function getPbAdmin(event?: H3Event): Promise<PocketBase> {
  const config = useRuntimeConfig(event)
  const email = config.pbAdminEmail?.trim()
  const password = config.pbAdminPassword

  if (!email || !password) {
    throw createError({
      statusCode: 503,
      statusMessage: 'PocketBase admin credentials are not configured for the web server'
    })
  }

  if (!cachedClient) {
    cachedClient = new PocketBase(resolveServerPbUrl(event))
    attachPocketBaseFetchTimeout(cachedClient)
  }

  if (!cachedClient.authStore.isValid) {
    if (!authInFlight) {
      authInFlight = withTimeout(
        cachedClient.collection('_superusers').authWithPassword(email, password),
        PB_FETCH_TIMEOUT_MS,
        'PocketBase admin auth'
      )
        .then(() => {
          authInFlight = null
        })
        .catch((error) => {
          authInFlight = null
          cachedClient?.authStore.clear()
          throw error
        })
    }
    await authInFlight
  }

  return cachedClient
}
