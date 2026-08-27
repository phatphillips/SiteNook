import type { A11yIssuesQuery } from './a11yQueries'
import type { AffectedPageSummary } from '~/utils/affectedPages'

const CACHE_MS = 30_000
const store = new Map<string, { expires: number, data: unknown }>()
const pagesStore = new Map<string, { expires: number, data: AffectedPageSummary[] }>()

function stableQueryKey(query: A11yIssuesQuery): string | null {
  if (query.search?.trim()) return null
  const parts = [
    query.page ?? 1,
    query.perPage ?? 20,
    (query.statuses ?? ['open']).join(','),
    (query.wcagLevels ?? []).join(','),
    query.wcagLevel ?? '',
    (query.impacts ?? []).join(','),
    (query.types ?? []).join(','),
    (query.elements ?? []).join(','),
    (query.roles ?? []).join(','),
    (query.targetCategories ?? []).join(',')
  ]
  return parts.join('|')
}

function pagesCacheKey(siteId: string, ruleId: string, statuses: string[]): string {
  return `${siteId}:${ruleId}:${statuses.join(',')}`
}

export function getCachedIssuesResponse(siteId: string, query: A11yIssuesQuery): unknown | null {
  const queryKey = stableQueryKey(query)
  if (!queryKey) return null
  const key = `${siteId}:${queryKey}`
  const entry = store.get(key)
  if (!entry || entry.expires < Date.now()) {
    store.delete(key)
    return null
  }
  return entry.data
}

export function setCachedIssuesResponse(siteId: string, query: A11yIssuesQuery, data: unknown): void {
  const queryKey = stableQueryKey(query)
  if (!queryKey) return
  const key = `${siteId}:${queryKey}`
  store.set(key, { expires: Date.now() + CACHE_MS, data })
}

export function getCachedAffectedPages(
  siteId: string,
  ruleId: string,
  statuses: string[]
): AffectedPageSummary[] | null {
  const key = pagesCacheKey(siteId, ruleId, statuses)
  const entry = pagesStore.get(key)
  if (!entry || entry.expires < Date.now()) {
    pagesStore.delete(key)
    return null
  }
  return entry.data
}

export function setCachedAffectedPages(
  siteId: string,
  ruleId: string,
  statuses: string[],
  data: AffectedPageSummary[]
): void {
  const key = pagesCacheKey(siteId, ruleId, statuses)
  pagesStore.set(key, { expires: Date.now() + CACHE_MS, data })
}

export function invalidateIssuesCache(siteId?: string): void {
  if (!siteId) {
    store.clear()
    pagesStore.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(`${siteId}:`)) store.delete(key)
  }
  for (const key of pagesStore.keys()) {
    if (key.startsWith(`${siteId}:`)) pagesStore.delete(key)
  }
}
