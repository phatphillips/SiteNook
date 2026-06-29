import type { A11yIssuesQuery } from './a11yQueries'

const CACHE_MS = 30_000
const store = new Map<string, { expires: number, data: unknown }>()

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

export function invalidateIssuesCache(siteId?: string): void {
  if (!siteId) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(`${siteId}:`)) store.delete(key)
  }
}
