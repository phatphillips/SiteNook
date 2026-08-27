import { createError, getHeader, getQuery, getRouterParam, setHeader } from 'h3'
import { markdownExportFilename } from '~/utils/contentExplorerTree'
import { requireSiteAccess } from '../../../../utils/requireSiteAccess'
import { pocketBaseFileUrl } from '../../../../utils/pocketbaseFileUrl'
import { buildStoreZip } from '../../../../utils/storeZip'

function fileFieldName(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

async function fetchPbFileBuffer(
  pb: Awaited<ReturnType<typeof requireSiteAccess>>['pb'],
  record: Record<string, unknown>,
  filename: string,
  token: string
): Promise<Buffer | null> {
  if (!filename) return null
  const fileUrl = pocketBaseFileUrl(pb, record, filename)
  const response = await fetch(fileUrl, { headers: { Authorization: token } })
  if (!response.ok) return null
  return Buffer.from(await response.arrayBuffer())
}

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const query = getQuery(event)
  const blobIdParam = typeof query.blobIds === 'string' ? query.blobIds : ''
  const singleBlobId = typeof query.blobId === 'string' ? query.blobId : ''

  if (!siteId) {
    throw createError({ statusCode: 400, statusMessage: 'siteId is required' })
  }

  const blobIds = blobIdParam
    ? blobIdParam.split(',').map(s => s.trim()).filter(Boolean)
    : singleBlobId
      ? [singleBlobId]
      : []

  if (!blobIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'blobId or blobIds is required' })
  }

  const { pb } = await requireSiteAccess(event, siteId)
  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  if (blobIds.length === 1) {
    const blob = await pb.collection('page_content_blobs').getOne(blobIds[0]!) as Record<string, unknown>
    if (String(blob.site ?? '') !== siteId) {
      throw createError({ statusCode: 404, statusMessage: 'Content blob not found' })
    }
    const filename = fileFieldName(blob.body)
    const buf = filename ? await fetchPbFileBuffer(pb, blob, filename, token) : null
    if (!buf) {
      throw createError({ statusCode: 404, statusMessage: 'Markdown file not found' })
    }

    const obs = await pb.collection('page_content_observations').getList(1, 1, {
      filter: `content_blob = "${blobIds[0]}" && site = "${siteId}"`,
      sort: '-observed_at',
      fields: 'url,title'
    })
    const row = obs.items[0] as { url?: string, title?: string } | undefined
    const exportName = markdownExportFilename(String(row?.url ?? 'page'), row?.title)

    setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
    setHeader(event, 'Content-Disposition', `attachment; filename="${exportName.split('/').pop() || 'page.md'}"`)
    return buf
  }

  const files: Array<{ name: string, data: Buffer }> = []
  for (const id of blobIds) {
    const blob = await pb.collection('page_content_blobs').getOne(id) as Record<string, unknown>
    if (String(blob.site ?? '') !== siteId) continue
    const filename = fileFieldName(blob.body)
    if (!filename) continue
    const buf = await fetchPbFileBuffer(pb, blob, filename, token)
    if (!buf) continue

    const obs = await pb.collection('page_content_observations').getList(1, 1, {
      filter: `content_blob = "${id}" && site = "${siteId}"`,
      sort: '-observed_at',
      fields: 'url,title'
    })
    const row = obs.items[0] as { url?: string, title?: string } | undefined
    const exportName = markdownExportFilename(String(row?.url ?? id), row?.title)
    files.push({ name: exportName, data: buf })
  }

  if (!files.length) {
    throw createError({ statusCode: 404, statusMessage: 'No exportable content found' })
  }

  const bytes = buildStoreZip(files)
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', 'attachment; filename="content-export.zip"')
  return bytes
})
