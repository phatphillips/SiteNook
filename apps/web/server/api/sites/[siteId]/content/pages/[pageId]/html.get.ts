import { createError, getRouterParam, setHeader } from 'h3'
import { requireSiteAccess } from '../../../../../../utils/requireSiteAccess'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const pageId = getRouterParam(event, 'pageId') ?? ''
  if (!siteId || !pageId) {
    throw createError({ statusCode: 400, statusMessage: 'siteId and pageId are required' })
  }

  const { pb } = await requireSiteAccess(event, siteId)

  let page: { site?: string, html_snapshot?: string }
  try {
    page = await pb.collection('pages').getOne(pageId, {
      fields: 'id,site,html_snapshot'
    }) as { site?: string, html_snapshot?: string }
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  if (String(page.site ?? '') !== siteId) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  return String(page.html_snapshot ?? '')
})
