import { createError, getRouterParam } from 'h3'
import { requireSiteAccess } from '../../../../../utils/requireSiteAccess'
import { loadIssueDetail } from '../../../../../utils/a11yQueries'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const issueId = getRouterParam(event, 'issueId') ?? ''
  const { pb } = await requireSiteAccess(event, siteId)

  if (!issueId) {
    throw createError({ statusCode: 400, statusMessage: 'issueId is required' })
  }

  try {
    return await loadIssueDetail(pb, siteId, issueId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw createError({ statusCode: 404, statusMessage: 'Issue not found' })
    }
    const message = error instanceof Error ? error.message : 'Failed to load issue'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
