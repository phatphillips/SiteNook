import { createError, getRouterParam } from 'h3'
import { requireSiteAccess } from '../../../../../utils/requireSiteAccess'
import { pageHasRenderedHtml } from '../../../../../utils/pageSnapshotHtml'
import {
  buildPageLivePreviewUrl,
  buildPageSnapshotUrl,
  signSnapshotTicket
} from '../../../../../utils/snapshotTicket'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const pageId = getRouterParam(event, 'pageId') ?? ''
  if (!siteId || !pageId) {
    throw createError({ statusCode: 400, statusMessage: 'siteId and pageId are required' })
  }

  const { user, pb } = await requireSiteAccess(event, siteId)

  let page: {
    id?: string
    site?: string
    url?: string
    rendered_html?: unknown
    html_snapshot?: string
    html_size_bytes?: number
  }
  try {
    page = await pb.collection('pages').getOne(pageId, {
      fields: 'id,site,url,rendered_html,html_snapshot,html_size_bytes'
    })
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  if (String(page.site ?? '') !== siteId) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  const pageUrl = String(page.url ?? '').trim()
  if (!pageUrl) {
    throw createError({ statusCode: 404, statusMessage: 'Page URL is missing' })
  }

  const ticket = signSnapshotTicket({
    uid: String(user.id),
    siteId,
    pageId
  }, event)

  const snapshotUrl = pageHasRenderedHtml(page)
    ? buildPageSnapshotUrl(siteId, pageId, ticket)
    : null

  return {
    livePreviewUrl: buildPageLivePreviewUrl(siteId, pageId, ticket),
    snapshotUrl,
    previewKind: snapshotUrl ? 'html' as const : 'image' as const
  }
})
