import { createError, getQuery, getRouterParam } from 'h3'
import { requireSiteAccess } from '../../../../utils/requireSiteAccess'
import { parseIssuesQueryFromParams, queryAccessibilityIssues } from '../../../../utils/a11yQueries'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const { pb } = await requireSiteAccess(event, siteId)
  const query = getQuery(event)

  try {
    return await queryAccessibilityIssues(
      pb,
      siteId,
      parseIssuesQueryFromParams(query as Record<string, unknown>)
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load issues'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
