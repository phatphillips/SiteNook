import { createError, getRouterParam } from 'h3'
import { getPbAdmin } from '../../../../utils/pbAdmin'
import { requireSiteAccess } from '../../../../utils/requireSiteAccess'
import { reconcileSiteCurrentA11y } from '../../../../utils/reconcileSiteCurrentA11y'
import { invalidateIssuesCache } from '../../../../utils/a11yIssuesCache'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  await requireSiteAccess(event, siteId)

  try {
    const admin = await getPbAdmin(event)
    const summary = await reconcileSiteCurrentA11y(admin, siteId)
    invalidateIssuesCache(siteId)
    return { currentA11y: summary }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reconcile accessibility summary'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
