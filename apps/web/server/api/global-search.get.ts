import PocketBase from 'pocketbase'
import { createError, getHeader, getQuery } from 'h3'
import { requirePbUser } from '../utils/requirePbUser'
import { requireUserOrganizationId } from '~/utils/orgAccess'
import { resolveServerPocketBaseUrl } from '../utils/resolvePbUrl'
import { runGlobalSearch, parseContentType, parseSearchMode } from '../utils/runGlobalSearch'
import { TypesenseUnavailableError } from '../utils/typesenseConfig'

function extractAuthToken(event: Parameters<typeof requirePbUser>[0]): string {
  const header = getHeader(event, 'authorization')?.trim()
  if (!header) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  return token
}

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  const orgId = requireUserOrganizationId(user)

  const query = getQuery(event)
  const q = String(query.q || '').trim()
  const mode = parseSearchMode(String(query.mode || 'exact'))
  const type = parseContentType(String(query.type || 'all'))
  const siteId = String(query.siteId || '').trim() || undefined
  const page = Number(query.page) || 1
  const perPage = Number(query.perPage) || undefined

  if (!q) {
    throw createError({ statusCode: 400, statusMessage: 'q is required' })
  }

  if (siteId) {
    const token = extractAuthToken(event)
    const pb = new PocketBase(resolveServerPocketBaseUrl(event))
    pb.authStore.save(token, null)
    try {
      const site = await pb.collection('sites').getOne(siteId, { fields: 'id' })
      if (!site?.id) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid siteId' })
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'statusCode' in err) throw err
      throw createError({ statusCode: 400, statusMessage: 'Invalid siteId' })
    }
  }

  try {
    return await runGlobalSearch(orgId, { q, mode, type, siteId, page, perPage })
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    if (error instanceof TypesenseUnavailableError) {
      throw createError({ statusCode: 503, statusMessage: error.message })
    }
    const message = error instanceof Error ? error.message : 'Search failed'
    if (message.includes('regular expression') || message.includes('too long')) {
      throw createError({ statusCode: 400, statusMessage: message })
    }
    if (message.includes('at least')) {
      throw createError({ statusCode: 400, statusMessage: message })
    }
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
