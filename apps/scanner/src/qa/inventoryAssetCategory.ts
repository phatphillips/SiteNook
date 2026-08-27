import { isInventoryImageUrl, isInventoryPdfUrl, normalizeInventoryUrl } from './inventoryUrl.js'

export type InventoryAssetCategory = 'image' | 'file' | 'pdf'

export function inventoryAssetCategory(item: {
  url: string
  mime_type?: string
  is_pdf?: boolean
  asset_category?: string
}): InventoryAssetCategory {
  const existing = item.asset_category
  if (existing === 'image' || existing === 'file' || existing === 'pdf') return existing
  if (item.is_pdf || isInventoryPdfUrl(item.url)) return 'pdf'
  if (String(item.mime_type || '').startsWith('image/') || isInventoryImageUrl(item.url)) return 'image'
  return 'file'
}

export type InventoryRow = {
  id?: string
  url: string
  scan?: string
  size_bytes?: number
  mime_type?: string
  content_type?: string
  is_pdf?: boolean
  asset_category?: string
}

export function mergeInventoryRow<T extends InventoryRow>(existing: T, candidate: T): T {
  const url = normalizeInventoryUrl(candidate.url)
  const asset_category = inventoryAssetCategory(candidate)
  const size_bytes = Math.max(existing.size_bytes ?? 0, candidate.size_bytes ?? 0)
  return {
    ...existing,
    ...candidate,
    url,
    asset_category,
    size_bytes: size_bytes > 0 ? size_bytes : (candidate.size_bytes ?? existing.size_bytes ?? 0)
  }
}

/** Dedupe inventory rows by normalized URL (keep largest size_bytes). */
export function dedupeInventoryRecords<T extends InventoryRow>(records: T[]): Array<Omit<T, 'id'>> {
  const byUrl = new Map<string, T>()
  for (const record of records) {
    const url = normalizeInventoryUrl(record.url)
    const key = url.toLowerCase()
    const normalized = { ...record, url, asset_category: inventoryAssetCategory(record) }
    const existing = byUrl.get(key)
    byUrl.set(key, existing ? mergeInventoryRow(existing, normalized) : normalized)
  }
  return [...byUrl.values()].map(({ id: _id, ...rest }) => rest as Omit<T, 'id'>)
}
