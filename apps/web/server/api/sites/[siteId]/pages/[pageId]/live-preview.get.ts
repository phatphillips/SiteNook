import { createError, getQuery, getRouterParam, removeResponseHeader, setHeader } from 'h3'
import { getPbAdmin } from '../../../../../utils/pbAdmin'
import { fileFieldName } from '../../../../../utils/pageSnapshotHtml'
import { fetchLivePageDocument, peekLivePageDocument } from '../../../../../utils/fetchLivePageHtml'
import { assertSnapshotTicketMatches, verifySnapshotTicket } from '../../../../../utils/snapshotTicket'
import { livePreviewFrameAncestors } from '~/utils/previewFrameOrigin'
import { canonicalUrlFromHtml, prepareLivePreviewHtml } from '~/utils/livePreviewHtml'
import { pocketBaseFileUrl } from '../../../../../utils/pocketbaseFileUrl'

function livePreviewResponseHeaders(event: Parameters<typeof setHeader>[0]) {
  try {
    removeResponseHeader(event, 'X-Frame-Options')
  } catch {
    // Older h3 mocks may not implement removeResponseHeader.
  }
  let appUrl = ''
  try {
    appUrl = String(useRuntimeConfig(event).public?.appUrl || '')
  } catch {
    appUrl = ''
  }
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Content-Security-Policy', [
    livePreviewFrameAncestors(appUrl),
    "default-src https: http: data: blob: 'unsafe-inline' 'unsafe-eval'",
    "script-src https: http: blob: data: 'unsafe-inline' 'unsafe-eval'",
    "style-src 'unsafe-inline' https: http: data: blob:",
    'font-src https: http: data:',
    'img-src https: http: data: blob:',
    'media-src https: http: data: blob:',
    'connect-src https: http: ws: wss: blob:',
    'frame-src https: http: data: blob:',
    "object-src 'none'"
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

async function readStoredHtml(
  pb: Awaited<ReturnType<typeof getPbAdmin>>,
  page: Record<string, unknown>
): Promise<string> {
  const filename = fileFieldName(page.rendered_html)
  if (filename) {
    try {
      const fromFile = await readRenderedHtmlFile(pb, page, filename)
      if (fromFile.trim()) return fromFile
    } catch (err) {
      console.warn(
        `Rendered HTML file unavailable for live preview page ${String(page.id ?? '')}:`,
        err instanceof Error ? err.message : err
      )
    }
  }
  return String(page.html_snapshot ?? '')
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

  const pageUrl = String(page.url ?? '').trim()
  const cachedLive = pageUrl ? peekLivePageDocument(pageUrl) : undefined

  let rawHtml = ''
  let baseUrl = pageUrl
  if (cachedLive && cachedLive.html.trim()) {
    rawHtml = cachedLive.html.trim()
    baseUrl = cachedLive.finalUrl || pageUrl
  } else if (pageUrl && cachedLive !== null) {
    const live = await fetchLivePageDocument(pageUrl)
    if (live?.html.trim()) {
      rawHtml = live.html.trim()
      baseUrl = live.finalUrl || pageUrl
    }
  }

  if (!rawHtml) {
    const storedHtml = (await readStoredHtml(pb, page)).trim()
    const canonical = storedHtml ? canonicalUrlFromHtml(storedHtml, pageUrl) : null
    if (canonical && canonical !== pageUrl) {
      const fromCanonical = await fetchLivePageDocument(canonical)
      if (fromCanonical?.html.trim()) {
        rawHtml = fromCanonical.html.trim()
        baseUrl = fromCanonical.finalUrl || canonical
      }
    }
    if (!rawHtml) rawHtml = storedHtml
  }

  if (!rawHtml) {
    throw createError({ statusCode: 404, statusMessage: 'No HTML snapshot for this page' })
  }

  livePreviewResponseHeaders(event)
  return prepareLivePreviewHtml(rawHtml, baseUrl)
})
