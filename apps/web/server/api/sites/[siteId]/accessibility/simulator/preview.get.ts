import { createError, getQuery, getRouterParam } from 'h3'
import { requireSiteAccess } from '../../../../../utils/requireSiteAccess'
import type { SimulatorTabOrderPayload } from '~/utils/simulatorTabOrder'

function fileFieldName(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

function parseTabOrder(raw: unknown): SimulatorTabOrderPayload | null {
  if (!raw) return null
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  const entries = Array.isArray(obj.entries) ? obj.entries : []
  return {
    pageWidth: Number(obj.pageWidth) || 0,
    pageHeight: Number(obj.pageHeight) || 0,
    entries: entries
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .map((e, i) => ({
        index: Number(e.index) || i + 1,
        tag: String(e.tag ?? ''),
        role: String(e.role ?? ''),
        name: String(e.name ?? ''),
        x: Number(e.x) || 0,
        y: Number(e.y) || 0,
        width: Number(e.width) || 0,
        height: Number(e.height) || 0
      }))
  }
}

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const query = getQuery(event)
  const pageId = typeof query.pageId === 'string' ? query.pageId : ''

  if (!siteId || !pageId) {
    throw createError({ statusCode: 400, statusMessage: 'siteId and pageId are required' })
  }

  const { pb } = await requireSiteAccess(event, siteId)

  const page = await pb.collection('pages').getOne(pageId, {
    fields: 'id,url,title,site,preview_image,tab_order'
  }) as {
    id: string
    url?: string
    title?: string
    site?: string
    preview_image?: string | string[]
    tab_order?: unknown
  }

  if (page.site && page.site !== siteId) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found for this site' })
  }

  const filename = fileFieldName(page.preview_image)
  const hasImage = Boolean(filename)
  const tabOrder = parseTabOrder(page.tab_order)
  const pageUrl = page.url || ''

  return {
    source: hasImage ? ('screenshot' as const) : null,
    previewImageUrl: hasImage
      ? `/api/sites/${siteId}/accessibility/simulator/preview-image?pageId=${encodeURIComponent(pageId)}`
      : null,
    tabOrder,
    pageUrl,
    title: page.title || ''
  }
})
