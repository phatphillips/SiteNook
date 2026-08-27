import { createError, getHeader, getRouterParam, setHeader } from 'h3'
import { requireSiteAccess } from '../../../../../../utils/requireSiteAccess'
import { pocketBaseFileUrl } from '../../../../../../utils/pocketbaseFileUrl'

function fileFieldName(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

async function fetchPbFileText(
  pb: Awaited<ReturnType<typeof requireSiteAccess>>['pb'],
  record: Record<string, unknown>,
  filename: string,
  token: string
): Promise<string | null> {
  if (!filename) return null
  const fileUrl = pocketBaseFileUrl(pb, record, filename)
  const response = await fetch(fileUrl, { headers: { Authorization: token } })
  if (!response.ok) return null
  return response.text()
}

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const blobId = getRouterParam(event, 'blobId') ?? ''
  if (!siteId || !blobId) {
    throw createError({ statusCode: 400, statusMessage: 'siteId and blobId are required' })
  }

  const { pb } = await requireSiteAccess(event, siteId)
  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const blob = await pb.collection('page_content_blobs').getOne(blobId) as Record<string, unknown>
  if (String(blob.site ?? '') !== siteId) {
    throw createError({ statusCode: 404, statusMessage: 'Content blob not found' })
  }

  const filename = fileFieldName(blob.body)
  if (!filename) {
    throw createError({ statusCode: 404, statusMessage: 'No Markdown file for this blob' })
  }

  const text = await fetchPbFileText(pb, blob, filename, token)
  if (text == null) {
    throw createError({ statusCode: 502, statusMessage: 'Failed to load Markdown file' })
  }

  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  return text
})
