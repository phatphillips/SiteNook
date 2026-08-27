import { createError, getQuery } from 'h3'
import { requireOrgAccess } from '../../../../utils/requireOrgAccess'
import { loadInventorySourcePages } from '../../../../utils/inventoryReferenceQueries'

export default defineEventHandler(async (event) => {
  const { pb } = await requireOrgAccess(event)
  const query = getQuery(event)
  const url = typeof query.url === 'string' ? query.url.trim() : ''
  const siteId = typeof query.siteId === 'string' ? query.siteId.trim() : ''
  if (!url) {
    throw createError({ statusCode: 400, statusMessage: 'url is required' })
  }
  if (!siteId) {
    throw createError({ statusCode: 400, statusMessage: 'siteId is required' })
  }

  try {
    const pages = await loadInventorySourcePages(pb, siteId, url)
    return { pages }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load inventory source pages'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
