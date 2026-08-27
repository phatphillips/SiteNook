import { normalizeInventoryUrl } from './inventoryUrl.js'

export type InventoryRefDraft = {
  scan: string
  page: string
  asset_url: string
}

/** One ref per normalized asset URL discovered on a page. */
export function buildInventoryRefsForPage(
  scanId: string,
  pageId: string,
  items: Array<{ url: string }>
): InventoryRefDraft[] {
  const refs: InventoryRefDraft[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const asset_url = normalizeInventoryUrl(item.url)
    const key = asset_url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    refs.push({ scan: scanId, page: pageId, asset_url })
  }
  return refs
}

export type InventoryRefRecord = {
  id: string
  asset_url: string
  page: string
}

export function dedupeInventoryRefIds(records: InventoryRefRecord[]): string[] {
  const keepByKey = new Map<string, string>()
  const deleteIds: string[] = []

  for (const record of records) {
    const key = `${normalizeInventoryUrl(record.asset_url).toLowerCase()}\0${record.page}`
    const existingId = keepByKey.get(key)
    if (!existingId) {
      keepByKey.set(key, record.id)
      continue
    }
    deleteIds.push(record.id)
  }

  return deleteIds
}

export function countInventoryRefsByAssetUrl(
  refs: Array<{ asset_url: string, page: string }>
): Map<string, number> {
  const pagesByUrl = new Map<string, Set<string>>()
  for (const ref of refs) {
    const key = normalizeInventoryUrl(ref.asset_url).toLowerCase()
    const pages = pagesByUrl.get(key) ?? new Set<string>()
    pages.add(ref.page)
    pagesByUrl.set(key, pages)
  }
  const counts = new Map<string, number>()
  for (const [key, pages] of pagesByUrl) {
    counts.set(key, pages.size)
  }
  return counts
}
