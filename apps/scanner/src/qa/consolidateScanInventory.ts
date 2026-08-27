import type PocketBase from 'pocketbase'
import { batchCreate } from '../db/pocketbaseClient.js'
import { dedupeInventoryRecords, inventoryAssetCategory } from './inventoryAssetCategory.js'

const DELETE_BATCH = 50

type InventoryRecord = {
  id: string
  url: string
  size_bytes?: number
  mime_type?: string
  content_type?: string
  is_pdf?: boolean
  asset_category?: string
}

async function deleteRecordsInBatches(pb: PocketBase, ids: string[]): Promise<void> {
  for (let index = 0; index < ids.length; index += DELETE_BATCH) {
    const batch = ids.slice(index, index + DELETE_BATCH)
    await Promise.all(batch.map(id => pb.collection('qa_inventory').delete(id)))
  }
}

/**
 * Collapse duplicate qa_inventory rows (same asset URL discovered on many pages)
 * into one row per scan. Dramatically speeds inventory API reads.
 */
export async function consolidateScanInventory(
  pb: PocketBase,
  scanId: string
): Promise<{ before: number, after: number }> {
  const records = await pb.collection('qa_inventory').getFullList({
    filter: `scan = "${scanId}"`,
    fields: 'id,url,scan,size_bytes,mime_type,content_type,is_pdf,asset_category'
  }) as InventoryRecord[]

  if (!records.length) return { before: 0, after: 0 }

  const deduped = dedupeInventoryRecords(records)
  const needsCategoryPatch = records.some(record => !record.asset_category)
  const needsRewrite = deduped.length !== records.length || needsCategoryPatch

  if (!needsRewrite) {
    return { before: records.length, after: records.length }
  }

  if (deduped.length !== records.length) {
    await deleteRecordsInBatches(pb, records.map(record => record.id))
    await batchCreate('qa_inventory', deduped.map(row => ({
      ...row,
      scan: scanId,
      asset_category: row.asset_category ?? inventoryAssetCategory(row)
    })))
    return { before: records.length, after: deduped.length }
  }

  for (let index = 0; index < records.length; index += DELETE_BATCH) {
    const batch = records.slice(index, index + DELETE_BATCH)
    await Promise.all(
      batch.map((record) => {
        const category = inventoryAssetCategory(record)
        if (record.asset_category === category) return Promise.resolve()
        return pb.collection('qa_inventory').update(record.id, { asset_category: category })
      })
    )
  }

  return { before: records.length, after: records.length }
}
