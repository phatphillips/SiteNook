import PocketBase from 'pocketbase'
import { createError, getHeader, getRouterParam, readBody } from 'h3'
import { requirePbUser } from '../../../utils/requirePbUser'
import { resolveServerPocketBaseUrl } from '../../../utils/resolvePbUrl'

const MAX_PDF_BYTES = 20 * 1024 * 1024
const FETCH_TIMEOUT_MS = 25_000

/**
 * Cache a crawl PDF into PocketBase file storage so preview no longer depends
 * on the remote URL being reachable from the Nuxt container.
 */
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

  if (doc.file) {
    return { ok: true, alreadyStored: true }
  }

  const url = String(doc.url ?? '').trim()
  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This PDF has no crawl URL to download. Upload a file instead.'
    })
  }

  // Optional body reserved for future; ignore for now
  await readBody(event).catch(() => null)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SiteNook-PDF-Cache/1.0',
        Accept: 'application/pdf,*/*'
      }
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw createError({
      statusCode: 502,
      statusMessage: aborted
        ? 'Timed out downloading the crawl URL. Upload a copy of the PDF instead.'
        : `Could not download crawl URL (${err instanceof Error ? err.message : 'fetch failed'}). Upload a copy instead.`
    })
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status === 403 ? 403 : 502,
      statusMessage: response.status === 403
        ? 'The crawl URL blocked download (403). Upload a copy to preview this PDF.'
        : `Crawl URL returned ${response.status}. Upload a copy to preview this PDF.`
    })
  }

  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_PDF_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'PDF exceeds the 20MB limit' })
  }

  let filename = String(doc.filename ?? '').trim() || url.split('/').pop() || 'document.pdf'
  try {
    filename = decodeURIComponent(filename.replace(/\+/g, ' '))
  } catch {
    // keep
  }
  if (!filename.toLowerCase().endsWith('.pdf')) filename = `${filename}.pdf`

  const form = new FormData()
  form.append(
    'file',
    new Blob([arrayBuffer], { type: 'application/pdf' }),
    filename
  )
  form.append('filename', filename)

  try {
    await pb.collection('pdf_documents').update(documentId, form)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw createError({
      statusCode: 502,
      statusMessage: `Downloaded PDF but failed to store it: ${message.slice(0, 160)}`
    })
  }

  return { ok: true, alreadyStored: false }
})
