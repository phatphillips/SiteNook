import { createError, getQuery } from 'h3'
import { requireOrgAccess } from '../../../utils/requireOrgAccess'
import { queryOrgAccessibilityIssues } from '../../../utils/orgA11yQueries'

export default defineEventHandler(async (event) => {
  const { orgId, pb } = await requireOrgAccess(event)
  const query = getQuery(event)

  try {
    return await queryOrgAccessibilityIssues(pb, orgId, query as Record<string, unknown>)
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to load org accessibility issues'
    })
  }
})
