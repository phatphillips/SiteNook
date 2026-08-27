import type PocketBase from 'pocketbase'
import { pbAnd, pbContains, pbRelation } from '~/utils/pbFilter'
import type { ResolvedOrgSite } from './orgSites'

type PbListOptions = {
  fields: string
  sort: string
}

/** Fetch collection rows per site scan in parallel (faster than one large OR filter on SQLite). */
export async function fetchPbFullListPerSiteScan<T>(
  pb: PocketBase,
  collection: string,
  sites: ResolvedOrgSite[],
  buildFilter: (scanId: string) => string,
  options: PbListOptions
): Promise<T[]> {
  const targets = sites.filter(site => site.latestScanId)
  if (!targets.length) return []

  const batches = await Promise.all(
    targets.map(async (site) => {
      const filter = buildFilter(site.latestScanId!)
      return pb.collection(collection).getFullList({
        filter,
        fields: options.fields,
        sort: options.sort
      }) as Promise<T[]>
    })
  )

  return batches.flat()
}

export function buildScanScopedSearchFilter(
  scanId: string,
  search: string | undefined,
  extraClauses: Array<string | null | undefined> = []
): string {
  const clauses = [pbRelation('scan', scanId), ...extraClauses]
  if (search?.trim()) clauses.push(pbContains('url', search.trim()))
  return pbAnd(clauses)
}

interface CacheEntry<T> {
  expires: number
  rows: T[]
}

const inventoryListCache = new Map<string, CacheEntry<unknown>>()
const INVENTORY_CACHE_MS = 45_000

export function inventoryListCacheKey(
  orgId: string,
  options: { siteId?: string, tab: string, search?: string }
): string {
  return `${orgId}:${options.siteId ?? 'all'}:${options.tab}:${options.search?.trim() ?? ''}`
}

export function getCachedInventoryList<T>(key: string): T[] | null {
  const hit = inventoryListCache.get(key)
  if (!hit || hit.expires <= Date.now()) {
    if (hit) inventoryListCache.delete(key)
    return null
  }
  return hit.rows as T[]
}

export function setCachedInventoryList<T>(key: string, rows: T[]): void {
  inventoryListCache.set(key, {
    rows,
    expires: Date.now() + INVENTORY_CACHE_MS
  })
}

/** Test helper — clears in-memory inventory cache between unit tests. */
export function clearInventoryListCache(): void {
  inventoryListCache.clear()
}
