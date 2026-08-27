import type PocketBase from 'pocketbase'
import { getPocketBase } from './pocketbaseClient.js'
import { contentPersistenceDisabled } from '../content/persistContentObservation.js'

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Clear page links on observations before pages are deleted during prune. */
export async function detachContentObservationsFromPages(pageIds: string[]): Promise<void> {
  if (!pageIds.length || contentPersistenceDisabled()) return
  const pb = getPocketBase()
  for (const pageId of pageIds) {
    try {
      const rows = await pb.collection('page_content_observations').getFullList({
        filter: `page = "${escapeFilterValue(pageId)}"`,
        fields: 'id'
      })
      await Promise.all(rows.map(row =>
        pb.collection('page_content_observations').update(row.id, { page: null })
      ))
    } catch (err) {
      console.warn(`Could not detach content observations for page ${pageId}:`, err)
    }
  }
}

async function collectBlobIdsForScan(pb: PocketBase, scanId: string): Promise<string[]> {
  try {
    const rows = await pb.collection('page_content_observations').getFullList({
      filter: `scan = "${escapeFilterValue(scanId)}"`,
      fields: 'content_blob'
    })
    return [...new Set(rows.map(r => String((r as { content_blob?: string }).content_blob ?? '')).filter(Boolean))]
  } catch {
    return []
  }
}

async function isBlobReferenced(pb: PocketBase, blobId: string): Promise<boolean> {
  try {
    const obs = await pb.collection('page_content_observations').getList(1, 1, {
      filter: `content_blob = "${escapeFilterValue(blobId)}"`,
      fields: 'id'
    })
    if (obs.items.length > 0) return true
    const pages = await pb.collection('pages').getList(1, 1, {
      filter: `content_blob = "${escapeFilterValue(blobId)}"`,
      fields: 'id'
    })
    return pages.items.length > 0
  } catch {
    return true
  }
}

async function garbageCollectBlobs(pb: PocketBase, blobIds: string[]): Promise<void> {
  for (const blobId of blobIds) {
    try {
      const referenced = await isBlobReferenced(pb, blobId)
      if (!referenced) {
        await pb.collection('page_content_blobs').delete(blobId)
      }
    } catch (err) {
      console.warn(`Content blob GC failed for ${blobId}:`, err)
    }
  }
}

/** Delete observations for a scan being removed; GC blobs that lose all references. */
export async function deleteContentObservationsForScan(scanId: string): Promise<void> {
  if (contentPersistenceDisabled()) return
  const pb = getPocketBase()
  const blobIds = await collectBlobIdsForScan(pb, scanId)
  try {
    const rows = await pb.collection('page_content_observations').getFullList({
      filter: `scan = "${escapeFilterValue(scanId)}"`,
      fields: 'id'
    })
    await Promise.all(rows.map(row => pb.collection('page_content_observations').delete(row.id)))
  } catch (err) {
    console.warn(`Could not delete content observations for scan ${scanId}:`, err)
  }
  await garbageCollectBlobs(pb, blobIds)
}
