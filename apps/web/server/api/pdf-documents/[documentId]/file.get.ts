import PocketBase from 'pocketbase'
import { createError, getHeader, getRouterParam, sendStream, setHeader } from 'h3'
import { requirePbUser } from '../../../utils/requirePbUser'
import { resolveServerPocketBaseUrl } from '../../../utils/resolvePbUrl'
import { pocketBaseFileUrl } from '../../../utils/pocketbaseFileUrl'

const FETCH_TIMEOUT_MS = 25_000

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export default defineEventHandler(async (event) => {
  await requirePbUser(event)

  const documentId = getRouterParam(event, 'documentId')?.trim()
  if (!documentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing document id' })
  }

  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const pb = new PocketBase(resolveServerPocketBaseUrl(event))
  pb.authStore.save(token, null)

  let doc: Record<string, unknown>
  try {
    doc = await pb.collection('pdf_documents').getOne(documentId) as Record<string, unknown>
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'PDF document not found' })
  }

  const file = String(doc.file ?? '')
  const url = String(doc.url ?? '')

  let response: Response
  let fromFile = false
  try {
    if (file) {
      fromFile = true
      const fileUrl = pocketBaseFileUrl(pb, doc, file)
      response = await fetchWithTimeout(fileUrl, {
        headers: { Authorization: token }
      })
    } else if (url) {
      response = await fetchWithTimeout(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'SiteNook-PDF-Preview/1.0',
          Accept: 'application/pdf,*/*'
        }
      })
    } else {
      throw createError({ statusCode: 404, statusMessage: 'PDF has no file or URL' })
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    const message = err instanceof Error ? err.message : String(err)
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw createError({
      statusCode: 502,
      statusMessage: aborted
        ? (fromFile
          ? 'Timed out fetching stored PDF from PocketBase. Try again shortly.'
          : 'Timed out fetching PDF from crawl URL. Upload a copy to preview it reliably.')
        : fromFile
          ? `Failed to download stored PDF: ${message.slice(0, 160)}`
          : `Failed to download crawl PDF: ${message.slice(0, 160)}. Upload a copy if the URL is blocked.`
    })
  }

  if (!response.ok || !response.body) {
    if (response.status === 403) {
      throw createError({
        statusCode: 403,
        statusMessage: fromFile
          ? 'PocketBase refused access to the stored PDF file.'
          : 'The crawl URL blocked SiteNook from fetching this PDF (403). Upload a copy to preview it.'
      })
    }
    throw createError({
      statusCode: response.status >= 400 && response.status < 600 ? response.status : 502,
      statusMessage: fromFile
        ? `Failed to fetch stored PDF (${response.status})`
        : `Failed to fetch PDF from crawl URL (${response.status}). Upload a copy to preview it.`
    })
  }

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  return sendStream(event, response.body)
})
