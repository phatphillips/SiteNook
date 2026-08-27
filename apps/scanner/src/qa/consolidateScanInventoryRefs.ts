import type PocketBase from 'pocketbase'
import { countInventoryRefsByAssetUrl, dedupeInventoryRefIds } from './inventoryRefs.js'
import { normalizeInventoryUrl } from './inventoryUrl.js'

const DELETE_BATCH = 50
const UPDATE_BATCH = 50

type RefRecord = {
  id: string
  asset_url: string
  page: string
}

async function deleteRecordsInBatches(pb: PocketBase, collection: string, ids: string[]): Promise<void> {
  for (let index = 0; index < ids.length; index += DELETE_BATCH) {
    const batch = ids.slice(index, index + DELETE_BATCH)
    await Promise.all(batch.map(id => pb.collection(collection).delete(id)))
  }
}

/**
 * Remove duplicate qa_inventory_refs rows (same asset URL + page).
 */
export async function consolidateScanInventoryRefs(
  pb: PocketBase,
  scanId: string
): Promise<{ before: number, after: number }> {
  let records: RefRecord[]
  try {
    records = await pb.collection('qa_inventory_refs').getFullList({
      filter: `scan = "${scanId}"`,
      fields: 'id,asset_url,page'
    }) as RefRecord[]
  } catch {
    return { before: 0, after: 0 }
  }

  if (!records.length) return { before: 0, after: 0 }

  const deleteIds = dedupeInventoryRefIds(records)
  if (deleteIds.length) {
    await deleteRecordsInBatches(pb, 'qa_inventory_refs', deleteIds)
  }

  return { before: records.length, after: records.length - deleteIds.length }
}

/**
 * Set qa_inventory.found_on_page_count from deduped refs for a scan.
 */
export async function patchInventoryFoundOnPageCounts(
  pb: PocketBase,
  scanId: string
): Promise<void> {
  let refs: Array<{ asset_url: string, page: string }> = []
  try {
    refs = await pb.collection('qa_inventory_refs').getFullList({
      filter: `scan = "${scanId}"`,
      fields: 'asset_url,page'
    }) as Array<{ asset_url: string, page: string }>
  } catch {
    return
  }

  const countsByUrl = countInventoryRefsByAssetUrl(refs)

  const inventory = await pb.collection('qa_inventory').getFullList({
    filter: `scan = "${scanId}"`,
    fields: 'id,url,found_on_page_count'
  }) as Array<{ id: string, url: string, found_on_page_count?: number }>

  for (let index = 0; index < inventory.length; index += UPDATE_BATCH) {
    const batch = inventory.slice(index, index + UPDATE_BATCH)
    await Promise.all(
      batch.map((row) => {
        const count = countsByUrl.get(normalizeInventoryUrl(row.url).toLowerCase()) ?? 0
        if (row.found_on_page_count === count) return Promise.resolve()
        return pb.collection('qa_inventory').update(row.id, { found_on_page_count: count })
      })
    )
  }
}
