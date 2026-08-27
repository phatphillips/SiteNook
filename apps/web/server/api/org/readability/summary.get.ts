import { createError, getQuery } from 'h3'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'
import { queryOrgReadabilitySummary } from '../../../utils/orgReadabilityQueries'

export default defineEventHandler(async (event) => {
  const { orgId, pb } = await requireOrgAccess(event)
  const query = getQuery(event)
  const siteId = typeof query.siteId === 'string' && query.siteId.trim()
    ? query.siteId.trim()
    : undefined

  try {
    return await queryOrgReadabilitySummary(pb, orgId, { siteId })
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load org readability summary'
    })
  }
})
