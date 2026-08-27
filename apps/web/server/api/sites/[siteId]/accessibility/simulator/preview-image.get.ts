import { createError, getHeader, getQuery, getRouterParam, sendStream, setHeader } from 'h3'
import { requireSiteAccess } from '../../../../../utils/requireSiteAccess'
import { pocketBaseFileUrl } from '../../../../../utils/pocketbaseFileUrl'

function fileFieldName(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

/**
 * Stream the stored simulator preview image for a page (auth + site access).
 */
export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const query = getQuery(event)
  const pageId = typeof query.pageId === 'string' ? query.pageId : ''

  if (!siteId || !pageId) {
    throw createError({ statusCode: 400, statusMessage: 'siteId and pageId are required' })
  }

  const { pb } = await requireSiteAccess(event, siteId)
  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  // Full record — fields: strips collectionId and makes pocketBaseFileUrl() return "".
  const page = await pb.collection('pages').getOne(pageId) as {
    id: string
    site?: string
    preview_image?: string | string[]
    collectionId?: string
    collectionName?: string
  }

  if (page.site && page.site !== siteId) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found for this site' })
  }

  const filename = fileFieldName(page.preview_image)
  if (!filename) {
    throw createError({ statusCode: 404, statusMessage: 'No preview image for this page' })
  }

  const fileUrl = pocketBaseFileUrl(
    pb,
    {
      ...page,
      collectionName: page.collectionName || 'pages',
      collectionId: page.collectionId
    },
    filename
  )
  if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) {
    throw createError({
      statusCode: 502,
      statusMessage: `Invalid preview file URL (${fileUrl || 'empty'})`
    })
  }

  const response = await fetch(fileUrl, {
    headers: { Authorization: token },
    signal: AbortSignal.timeout(20_000)
  })

  if (!response.ok || !response.body) {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to load preview image (${response.status})`
    })
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  return sendStream(event, response.body)
})
