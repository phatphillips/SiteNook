import { createError, getQuery } from 'h3'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'
import { parseOrgListQuery } from '../../../utils/orgSites'
import { queryOrgPolicyMatches } from '../../../utils/orgQaQueries'

export default defineEventHandler(async (event) => {
  const { orgId, pb } = await requireOrgAccess(event)
  const query = getQuery(event)
  const { page, perPage, siteId } = parseOrgListQuery(query as Record<string, unknown>)
  const status = query.status === 'open' || query.status === 'dismissed' || query.status === 'fixed'
    ? query.status
    : undefined

  try {
    return await queryOrgPolicyMatches(pb, orgId, { page, perPage, siteId, status })
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : (error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Failed to load org policy matches')
    console.error('[org/qa/policy-matches]', message, error)
    throw createError({
      statusCode: 500,
      statusMessage: message || 'Failed to load org policy matches'
    })
  }
})
