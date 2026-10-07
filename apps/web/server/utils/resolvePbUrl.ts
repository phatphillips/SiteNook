import { createError, type H3Event } from 'h3'

/**
 * PocketBase URL for Nitro/server SDK calls.
 * Prefer NUXT_POCKETBASE_URL (Docker-internal) over the browser-facing public URL.
 */
export function resolveServerPocketBaseUrl(event?: H3Event): string {
  const config = useRuntimeConfig(event)
  const serverUrl = config.pocketbaseUrl?.trim()
  if (serverUrl) return serverUrl

  const publicUrl = config.public.pocketbaseUrl?.trim()
  if (publicUrl && /^https?:\/\//i.test(publicUrl)) {
    return publicUrl
  }

  // Browser-relative URL (e.g. /api behind nginx). Server needs an absolute PocketBase URL.
  if (publicUrl?.startsWith('/')) {
    return process.env.NUXT_POCKETBASE_URL?.trim() || 'http://127.0.0.1:8090'
  }

  throw createError({
    statusCode: 503,
    statusMessage: 'PocketBase URL is not configured for server requests (set NUXT_POCKETBASE_URL)'
  })
}
