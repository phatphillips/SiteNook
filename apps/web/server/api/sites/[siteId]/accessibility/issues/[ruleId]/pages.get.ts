import { createError, getRouterParam } from 'h3'
import { requireSiteAccess } from '../../../../../../utils/requireSiteAccess'
import { loadAffectedPagesForRule } from '../../../../../../utils/a11yQueries'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const ruleId = getRouterParam(event, 'ruleId') ?? ''
  if (!ruleId.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'ruleId is required' })
  }

  const { pb } = await requireSiteAccess(event, siteId)

  try {
    const pages = await loadAffectedPagesForRule(pb, siteId, ruleId, { statuses: ['open'] })
    return { pages }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load affected pages'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
