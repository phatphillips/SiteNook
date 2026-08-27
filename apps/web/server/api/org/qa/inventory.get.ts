import { createError, getQuery } from 'h3'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'
import { parseOrgListQuery } from '../../../utils/orgSites'
import { queryOrgInventory, type OrgInventoryTab } from '../../../utils/orgInventoryQueries'

export default defineEventHandler(async (event) => {
  const { orgId, pb } = await requireOrgAccess(event)
  const query = getQuery(event)
  const { page, perPage, siteId } = parseOrgListQuery(query as Record<string, unknown>)
  const search = typeof query.search === 'string' ? query.search.trim() : undefined
  const tab = typeof query.tab === 'string' ? query.tab as OrgInventoryTab : 'pages'

  try {
    return await queryOrgInventory(pb, orgId, { page, perPage, siteId, search, tab })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load org inventory'
    })
  }
})
