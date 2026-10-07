import type PocketBase from 'pocketbase'
import { pbRelation } from '~/utils/pbFilter'

/** Above this size, client-side getFullList is blocked (OOM risk). */
export const FULL_LIST_MAX_ITEMS = 2000

export async function countCollection(
  pb: PocketBase,
  collection: string,
  filter?: string
): Promise<number> {
  try {
    const result = await pb.collection(collection).getList(1, 1, {
      filter: filter || undefined,
      fields: 'id'
    })
    return result.totalItems
  } catch {
    return 0
  }
}

export class FullListGuardError extends Error {
  readonly totalItems: number
  readonly collection: string

  constructor(collection: string, totalItems: number) {
    super(
      `Collection "${collection}" has ${totalItems.toLocaleString()} records. Use paginated loading instead.`
    )
    this.name = 'FullListGuardError'
    this.collection = collection
    this.totalItems = totalItems
  }
}

export async function safeGetFullList<T>(
  pb: PocketBase,
  collection: string,
  options: { filter?: string, expand?: string, fields?: string }
): Promise<T[]> {
  const total = await countCollection(pb, collection, options.filter)
  if (total > FULL_LIST_MAX_ITEMS) {
    throw new FullListGuardError(collection, total)
  }
  return pb.collection(collection).getFullList(options) as Promise<T[]>
}

export async function averageReadabilityForScan(
  pb: PocketBase,
  scanId: string
): Promise<number> {
  const total = await countCollection(pb, 'pages', pbRelation('scan', scanId))
  if (!total || total > FULL_LIST_MAX_ITEMS) return 0

  const pages = await pb.collection('pages').getFullList({
    filter: pbRelation('scan', scanId),
    fields: 'readability_score'
  }) as Array<{ readability_score?: number }>

  if (!pages.length) return 0
  const sum = pages.reduce((n, p) => n + (p.readability_score || 0), 0)
  return Math.round(sum / pages.length)
}
