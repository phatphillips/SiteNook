import type PocketBase from 'pocketbase'
import type { Scan } from '~/types/sitenook'
import { pbAnd, pbOr, pbRelation } from '~/utils/pbFilter'
import { normalizeInventoryUrl } from '~/utils/inventoryUrl'
import {
  buildDisplayScansFilter,
  pickDisplayScan,
  sortScansForDisplay
} from '~/utils/scanDisplay'

export interface InventorySourcePageSummary {
  url: string
  title?: string
}

function pbUrlEquals(field: string, value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `${field} = "${escaped}"`
}

export async function resolveInventoryScanId(
  pb: PocketBase,
  siteId: string
): Promise<string | null> {
  const scanList = await pb.collection('scans').getFullList({
    filter: buildDisplayScansFilter(siteId),
    fields: 'id,site,status,completed_at,started_at,created'
  }) as unknown as Scan[]

  return pickDisplayScan(sortScansForDisplay(scanList))?.id ?? null
}

type RefRow = {
  page: string
}

async function loadPagesByIds(
  pb: PocketBase,
  pageIds: string[]
): Promise<Map<string, InventorySourcePageSummary>> {
  const uniqueIds = [...new Set(pageIds.filter(Boolean))]
  if (!uniqueIds.length) return new Map()

  const pages = await pb.collection('pages').getFullList({
    filter: pbOr(uniqueIds.map(id => pbRelation('id', id))),
    fields: 'id,url,title'
  }) as Array<{ id: string, url?: string, title?: string }>

  const byId = new Map<string, InventorySourcePageSummary>()
  for (const page of pages) {
    const url = page.url?.trim()
    if (!url) continue
    byId.set(page.id, {
      url,
      title: page.title?.trim() || undefined
    })
  }
  return byId
}

function mergeSourcePages(
  refs: RefRow[],
  pagesById: Map<string, InventorySourcePageSummary>
): InventorySourcePageSummary[] {
  const byUrl = new Map<string, InventorySourcePageSummary>()

  for (const ref of refs) {
    const summary = pagesById.get(ref.page)
    if (!summary?.url) continue
    const key = summary.url.toLowerCase()
    if (!byUrl.has(key)) byUrl.set(key, summary)
  }

  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url))
}

export async function loadInventorySourcePages(
  pb: PocketBase,
  siteId: string,
  rawAssetUrl: string
): Promise<InventorySourcePageSummary[]> {
  const scanId = await resolveInventoryScanId(pb, siteId)
  if (!scanId) return []

  const assetUrl = normalizeInventoryUrl(rawAssetUrl.trim())
  if (!assetUrl) return []

  let refs: RefRow[]
  try {
    refs = await pb.collection('qa_inventory_refs').getFullList({
      filter: pbAnd([pbRelation('scan', scanId), pbUrlEquals('asset_url', assetUrl)]),
      fields: 'page',
      sort: 'page'
    }) as RefRow[]
  } catch {
    return []
  }

  if (!refs.length) return []

  const pagesById = await loadPagesByIds(pb, refs.map(ref => ref.page))
  return mergeSourcePages(refs, pagesById)
}
