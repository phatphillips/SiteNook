import type { GlobalSearchParams, GlobalSearchResponse } from '~/types/globalSearch'
import { MIN_QUERY_LENGTH, normalizeSearchQuery } from '~/utils/globalSearch'
import { isTypesenseEnabled, TypesenseUnavailableError } from './typesenseConfig'
import { runTypesenseSearch } from './searchQuery'

export type SearchMode = GlobalSearchParams['mode']
export type SearchContentType = GlobalSearchParams['type']

export function parseSearchMode(raw: string): SearchMode {
  if (raw === 'contains' || raw === 'regex') return raw
  return 'exact'
}

export function parseContentType(raw: string): SearchContentType {
  if (raw === 'webpages' || raw === 'pdfs') return raw
  return 'all'
}

export async function runGlobalSearch(
  orgId: string,
  params: GlobalSearchParams
): Promise<GlobalSearchResponse> {
  if (!isTypesenseEnabled()) {
    throw new TypesenseUnavailableError()
  }

  const query = normalizeSearchQuery(params.q)
  if (query.length < MIN_QUERY_LENGTH) {
    throw new Error(`Search query must be at least ${MIN_QUERY_LENGTH} characters`)
  }

  try {
    return await runTypesenseSearch(orgId, { ...params, q: query })
  } catch (err) {
    if (err instanceof TypesenseUnavailableError) throw err
    const message = err instanceof Error ? err.message : 'Search failed'
    if (message.includes('Not Found') || message.includes('Connection')) {
      throw new TypesenseUnavailableError()
    }
    throw err
  }
}
