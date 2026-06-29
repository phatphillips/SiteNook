import PocketBase from 'pocketbase'
import { createError, getHeader, getRouterParam, sendStream, setHeader } from 'h3'
import { requirePbUser } from '../../../utils/requirePbUser'
import { resolveServerPocketBaseUrl } from '../../../utils/resolvePbUrl'

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
  if (file) {
    const fileUrl = pb.files.getUrl(doc, file)
    response = await fetch(fileUrl, {
      headers: { Authorization: token }
    })
  } else if (url) {
    response = await fetch(url, { redirect: 'follow' })
  } else {
    throw createError({ statusCode: 404, statusMessage: 'PDF has no file or URL' })
  }

  if (!response.ok || !response.body) {
    throw createError({
      statusCode: response.status || 502,
      statusMessage: `Failed to fetch PDF (${response.status})`
    })
  }

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  return sendStream(event, response.body)
})
