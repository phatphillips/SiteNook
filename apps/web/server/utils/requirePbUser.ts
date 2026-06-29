import PocketBase from 'pocketbase'
import { createError, type H3Event, getHeader } from 'h3'
import { resolveServerPocketBaseUrl } from './resolvePbUrl'

function extractAuthToken(event: H3Event): string | null {
  const header = getHeader(event, 'authorization')?.trim()
  if (!header) return null
  return header.replace(/^Bearer\s+/i, '').trim() || null
}

/** Validates the caller's PocketBase user token for Nitro API routes. */
export async function requirePbUser(event: H3Event) {
  const token = extractAuthToken(event)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const pb = new PocketBase(resolveServerPocketBaseUrl(event))
  pb.autoCancellation(false)
  pb.authStore.save(token, null)

  try {
    const result = await pb.collection('users').authRefresh()
    if (!result.record) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' })
    }
    return result.record
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired session' })
  }
}
