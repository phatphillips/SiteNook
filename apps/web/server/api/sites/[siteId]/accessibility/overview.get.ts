import { createError, getQuery, getRouterParam } from 'h3'
import { requireSiteAccess } from '../../../../utils/requireSiteAccess'
import { queryAccessibilityOverview } from '../../../../utils/a11yQueries'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const { pb } = await requireSiteAccess(event, siteId)
  const query = getQuery(event)

  try {
    return await queryAccessibilityOverview(pb, siteId, {
      from: String(query.from || '').trim() || undefined,
      to: String(query.to || '').trim() || undefined
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load overview'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
