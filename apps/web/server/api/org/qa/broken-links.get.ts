import { createError, getQuery } from 'h3'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'
import { parseOrgListQuery } from '../../../utils/orgSites'
import { queryOrgBrokenLinks } from '../../../utils/orgQaQueries'

export default defineEventHandler(async (event) => {
  const { orgId, pb } = await requireOrgAccess(event)
  const query = getQuery(event)
  const { page, perPage, siteId, hrefQuery } = parseOrgListQuery(query as Record<string, unknown>)

  try {
    return await queryOrgBrokenLinks(pb, orgId, { page, perPage, siteId, hrefQuery })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load org broken links'
    })
  }
})
