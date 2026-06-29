/** Shared PocketBase field lists and filter helpers for accessibility queries. */

export const A11Y_PAGE_ID_BATCH_SIZE = 80

export function pbOrPageIds(pageIds: string[]): string {
  return pageIds.map(id => `page = "${id}"`).join(' || ')
}

export function chunkPageIds(pageIds: string[], batchSize = A11Y_PAGE_ID_BATCH_SIZE): string[][] {
  const batches: string[][] = []
  for (let i = 0; i < pageIds.length; i += batchSize) {
    batches.push(pageIds.slice(i, i + batchSize))
  }
  return batches
}
