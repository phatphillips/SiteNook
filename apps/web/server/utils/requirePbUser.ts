import type { RecordModel } from 'pocketbase'
import PocketBase from 'pocketbase'
import { createError, type H3Event, getHeader } from 'h3'
import { resolveServerPocketBaseUrl } from './resolvePbUrl'

const AUTH_CACHE_TTL_MS = 60_000

const authCache = new Map<string, { expires: number, record: RecordModel }>()

function extractAuthToken(event: H3Event): string | null {
  const header = getHeader(event, 'authorization')?.trim()
  if (!header) return null
  return header.replace(/^Bearer\s+/i, '').trim() || null
}

/** Clears the short-lived token validation cache (tests / hot reload). */
export function clearPbUserAuthCache() {
  authCache.clear()
}

/** Validates the caller's PocketBase user token for Nitro API routes. */
export async function requirePbUser(event: H3Event) {
  const token = extractAuthToken(event)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const cached = authCache.get(token)
  if (cached && cached.expires > Date.now()) {
    return cached.record
  }

  const pb = new PocketBase(resolveServerPocketBaseUrl(event))
  pb.autoCancellation(false)
  pb.authStore.save(token, null)

  try {
    const result = await pb.collection('users').authRefresh()
    if (!result.record) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' })
    }
    authCache.set(token, {
      expires: Date.now() + AUTH_CACHE_TTL_MS,
      record: result.record
    })
    return result.record
  } catch (error) {
    authCache.delete(token)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' })
  }
}
