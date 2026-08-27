import { createError, getQuery, getRouterParam, removeResponseHeader, setHeader } from 'h3'
import { getPbAdmin } from '../../../../../utils/pbAdmin'
import { fileFieldName } from '../../../../../utils/pageSnapshotHtml'
import { assertSnapshotTicketMatches, verifySnapshotTicket } from '../../../../../utils/snapshotTicket'
import { prepareSnapshotPreviewHtml } from '~/utils/simulatorHtml'
import { pocketBaseFileUrl } from '../../../../../utils/pocketbaseFileUrl'

function snapshotResponseHeaders(event: Parameters<typeof setHeader>[0]) {
  // Nuxt/Nitro default DENY would leave the explorer iframe on about:blank.
  try {
    removeResponseHeader(event, 'X-Frame-Options')
  } catch {
    // Older h3 mocks may not implement removeResponseHeader.
  }
  setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Content-Security-Policy', [
    "frame-ancestors 'self'",
    "script-src 'none'",
    "object-src 'none'",
    "style-src 'unsafe-inline' https: http:",
    'font-src https: http: data:',
    'img-src https: http: data: blob:',
    'media-src https: http: data: blob:'
  ].join('; '))
  setHeader(event, 'Cache-Control', 'private, no-store')
}

async function readRenderedHtmlFile(
  pb: Awaited<ReturnType<typeof getPbAdmin>>,
  page: Record<string, unknown>,
  filename: string
): Promise<string> {
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
    throw new Error(`Invalid rendered HTML file URL (${fileUrl || 'empty'})`)
  }

  const adminToken = pb.authStore.token
  const response = await fetch(fileUrl, {
    headers: adminToken ? { Authorization: adminToken } : {},
    signal: AbortSignal.timeout(8_000)
  })
  if (!response.ok) {
    throw new Error(`Failed to load rendered HTML (${response.status})`)
  }
  return response.text()
}

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const pageId = getRouterParam(event, 'pageId') ?? ''
  const query = getQuery(event)
  const ticket = typeof query.ticket === 'string' ? query.ticket.trim() : ''

  if (!siteId || !pageId) {
    throw createError({ statusCode: 400, statusMessage: 'siteId and pageId are required' })
  }
  if (!ticket) {
    throw createError({ statusCode: 401, statusMessage: 'Snapshot ticket is required' })
  }

  const payload = verifySnapshotTicket(ticket, event)
  assertSnapshotTicketMatches(payload, siteId, pageId)

  const pb = await getPbAdmin(event)
  let page: Record<string, unknown>
  try {
    page = await pb.collection('pages').getOne(pageId) as Record<string, unknown>
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  if (String(page.site ?? '') !== siteId) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  const filename = fileFieldName(page.rendered_html)
  if (!filename) {
    throw createError({ statusCode: 404, statusMessage: 'No HTML snapshot for this page' })
  }

  let rawHtml = ''
  try {
    rawHtml = await readRenderedHtmlFile(pb, page, filename)
  } catch (err) {
    console.warn(
      `Rendered HTML file unavailable for page ${pageId}:`,
      err instanceof Error ? err.message : err
    )
  }
  if (!rawHtml.trim()) {
    throw createError({ statusCode: 404, statusMessage: 'No HTML snapshot for this page' })
  }

  const pageUrl = String(page.url ?? '').trim()
  snapshotResponseHeaders(event)
  return prepareSnapshotPreviewHtml(rawHtml, pageUrl)
})
