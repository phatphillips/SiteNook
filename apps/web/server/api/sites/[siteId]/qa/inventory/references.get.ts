import { createError, getQuery, getRouterParam } from 'h3'
import { requireSiteAccess } from '../../../../../utils/requireSiteAccess'
import { loadInventorySourcePages } from '../../../../../utils/inventoryReferenceQueries'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const query = getQuery(event)
  const url = typeof query.url === 'string' ? query.url.trim() : ''
  if (!url) {
    throw createError({ statusCode: 400, statusMessage: 'url is required' })
  }

  const { pb } = await requireSiteAccess(event, siteId)

  try {
    const pages = await loadInventorySourcePages(pb, siteId, url)
    return { pages }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load inventory source pages'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
