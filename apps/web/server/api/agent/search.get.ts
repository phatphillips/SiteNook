import { createError, getQuery } from 'h3'
import { requireAgentAuth, requireAgentSiteAccess } from '../../utils/requireAgentAuth'
import { runGlobalSearch, parseContentType, parseSearchMode } from '../../utils/runGlobalSearch'
import { TypesenseUnavailableError } from '../../utils/typesenseConfig'

export default defineEventHandler(async (event) => {
  const ctx = await requireAgentAuth(event)
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
    await requireAgentSiteAccess(ctx, siteId)
  }

  try {
    return await runGlobalSearch(ctx.orgId, { q, mode, type, siteId, page, perPage })
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    if (error instanceof TypesenseUnavailableError) {
      throw createError({ statusCode: 503, statusMessage: error.message })
    }
    const message = error instanceof Error ? error.message : 'Search failed'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
