import PocketBase from 'pocketbase'
import { createError, getHeader, getRouterParam, getQuery, sendStream, setHeader } from 'h3'
import { requirePbUser } from '../../../utils/requirePbUser'
import { resolveServerPocketBaseUrl } from '../../../utils/resolvePbUrl'
import { pocketBaseFileUrl } from '../../../utils/pocketbaseFileUrl'

const ARTIFACT_FIELDS = new Set(['structure_json', 'structure_html', 'structure_markdown'])

export default defineEventHandler(async (event) => {
  await requirePbUser(event)

  const documentId = getRouterParam(event, 'documentId')?.trim()
  if (!documentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing document id' })
  }

  const query = getQuery(event)
  const field = String(query.field || '').trim()
  if (!ARTIFACT_FIELDS.has(field)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid structure artifact field' })
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

  const filename = String(doc[field] ?? '')
  if (!filename) {
    throw createError({ statusCode: 404, statusMessage: 'Structure artifact not found' })
  }

  const fileUrl = pocketBaseFileUrl(pb, doc, filename)
  const response = await fetch(fileUrl, {
    headers: { Authorization: token }
  })
  if (!response.ok || !response.body) {
    throw createError({
      statusCode: response.status || 502,
      statusMessage: `Failed to fetch structure artifact (${response.status})`
    })
  }

  const mime =
    field === 'structure_json'
      ? 'application/json'
      : field === 'structure_html'
        ? 'text/html; charset=utf-8'
        : 'text/markdown; charset=utf-8'
  setHeader(event, 'Content-Type', mime)
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  return sendStream(event, response.body)
})
