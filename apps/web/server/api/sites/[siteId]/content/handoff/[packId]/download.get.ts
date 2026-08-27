import { createError, getHeader, getRouterParam, setHeader } from 'h3'
import { requireSiteAccess } from '../../../../../../utils/requireSiteAccess'
import { pocketBaseFileUrl } from '../../../../../../utils/pocketbaseFileUrl'

function fileFieldName(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const packId = getRouterParam(event, 'packId') ?? ''
  if (!siteId || !packId) {
    throw createError({ statusCode: 400, statusMessage: 'siteId and packId are required' })
  }

  const { pb } = await requireSiteAccess(event, siteId)
  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const pack = await pb.collection('ai_handoff_packs').getOne(packId) as Record<string, unknown>
  if (String(pack.site ?? '') !== siteId) {
    throw createError({ statusCode: 404, statusMessage: 'Pack not found' })
  }

  const artifact = fileFieldName(pack.artifact)
  if (!artifact) {
    throw createError({ statusCode: 404, statusMessage: 'Artifact not available' })
  }

  const response = await fetch(pocketBaseFileUrl(pb, pack, artifact), {
    headers: { Authorization: token }
  })
  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: 'Failed to load handoff artifact' })
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  const section = String(pack.section || 'content')
  const pageCount = Number(pack.page_count || 0) || 0
  const filename = `ai-handoff-${section}-${pageCount}p.zip`

  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  return bytes
})
