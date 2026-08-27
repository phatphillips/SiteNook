import { createError, getQuery } from 'h3'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'
import { parseOrgListQuery } from '../../../utils/orgSites'
import { queryOrgSpelling } from '../../../utils/orgQaQueries'

export default defineEventHandler(async (event) => {
  const { orgId, pb } = await requireOrgAccess(event)
  const query = getQuery(event)
  const { page, perPage, siteId } = parseOrgListQuery(query as Record<string, unknown>)
  const confidence = query.confidence === 'error' || query.confidence === 'review'
    ? query.confidence
    : undefined

  try {
    return await queryOrgSpelling(pb, orgId, { page, perPage, siteId, confidence })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load org spelling issues'
    })
  }
})
