import { createError, getQuery, getRouterParam } from 'h3'
import { requireAgentAuth, requireAgentSiteAccess } from '../../../../../utils/requireAgentAuth'
import { parseIssuesQueryFromParams, queryAccessibilityIssues } from '../../../../../utils/a11yQueries'

export default defineEventHandler(async (event) => {
  const ctx = await requireAgentAuth(event)
  const siteId = getRouterParam(event, 'siteId') ?? ''
  await requireAgentSiteAccess(ctx, siteId)
  const query = getQuery(event)

  try {
    return await queryAccessibilityIssues(
      ctx.pb,
      siteId,
      parseIssuesQueryFromParams(query as Record<string, unknown>)
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load issues'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
