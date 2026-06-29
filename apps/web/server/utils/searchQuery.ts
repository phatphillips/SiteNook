import type {
  GlobalSearchParams,
  GlobalSearchResponse,
  GlobalSearchResultItem,
  SearchContentType,
  SearchMode
} from '~/types/globalSearch'
import {
  buildSnippet,
  DEFAULT_PER_PAGE,
  findMatchIndex,
  MAX_PER_PAGE,
  MAX_SCAN_RECORDS,
  MIN_QUERY_LENGTH,
  normalizeSearchQuery,
  pdfSearchFields,
  searchFields,
  webpageSearchFields
} from '~/utils/globalSearch'
import { getTypesenseClient, SEARCH_COLLECTION } from './typesenseClient'
import { TypesenseUnavailableError } from './typesenseConfig'
import {
  findUrlMatchIndex,
  isUrlLikeQuery,
  typesenseTokenForUrlQuery,
  urlQueryMatchesInText
} from '~/utils/urlSearch'

const QUERY_BY = 'title,body,url,pdfAuthor,pdfSubject,pdfKeywords,pdfCreator,pdfProducer'

const FIELD_LABELS: Record<string, string> = {
  title: 'Page title',
  body: 'HTML',
  url: 'URL',
  pdfAuthor: 'PDF Author',
  pdfSubject: 'PDF Subject',
  pdfKeywords: 'PDF Keywords',
  pdfCreator: 'PDF Creator',
  pdfProducer: 'PDF Producer'
}

export interface IndexedSearchDocument {
  id: string
  orgId: string
  siteId: string
  siteName: string
  url: string
  urlKey: string
  type: 'webpage' | 'pdf'
  title?: string
  body?: string
  pdfAuthor?: string
  pdfSubject?: string
  pdfKeywords?: string
  pdfCreator?: string
  pdfProducer?: string
  lastScannedAt: number
  pageId?: string
  pdfDocumentId?: string
}

export function escapeFilterValue(value: string): string {
  return `\`${value.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``
}

export function buildSearchFilter(
  orgId: string,
  siteId?: string,
  type?: SearchContentType
): string {
  const parts = [`orgId:=${escapeFilterValue(orgId)}`]
  if (siteId) parts.push(`siteId:=${escapeFilterValue(siteId)}`)
  if (type === 'webpages') parts.push('type:=webpage')
  if (type === 'pdfs') parts.push('type:=pdf')
  return parts.join(' && ')
}

export function typesenseQueryForMode(query: string, mode: SearchMode): string {
  if (mode === 'exact') {
    const escaped = query.replace(/"/g, '\\"')
    return `"${escaped}"`
  }
  return query
}

export function matchedFieldLabel(field: string, docType: 'webpage' | 'pdf'): string {
  if (field === 'body') return docType === 'pdf' ? 'PDF body' : 'HTML'
  return FIELD_LABELS[field] || field
}

export function snippetFromHighlight(
  highlights: Array<{ field?: string, snippet?: string, snippets?: string[] }> | undefined,
  doc: IndexedSearchDocument
): { matchedIn: string, snippet: string } | null {
  if (!highlights?.length) return null
  const first = highlights[0]
  const field = String(first.field ?? '')
  const raw = first.snippet || first.snippets?.[0] || ''
  if (!raw) return null
  const snippet = raw.replace(/<mark>/g, '').replace(/<\/mark>/g, '').replace(/\s+/g, ' ').trim()
  return {
    matchedIn: matchedFieldLabel(field, doc.type),
    snippet
  }
}

export function mapDocumentToResult(
  doc: IndexedSearchDocument,
  matchedIn: string,
  snippet: string
): GlobalSearchResultItem {
  const lastScannedAt = doc.lastScannedAt
    ? new Date(doc.lastScannedAt).toISOString()
    : null

  return {
    id: doc.id,
    siteId: doc.siteId,
    siteName: doc.siteName,
    url: doc.url,
    type: doc.type,
    matchedIn,
    snippet,
    lastScannedAt,
    ...(doc.pdfDocumentId ? { pdfDocumentId: doc.pdfDocumentId } : {})
  }
}

function searchableFieldsForDoc(doc: IndexedSearchDocument) {
  if (doc.type === 'pdf') {
    return pdfSearchFields({
      url: doc.url,
      filename: doc.title,
      documentTitle: doc.title,
      textContent: doc.body,
      metadata: {
        author: doc.pdfAuthor,
        subject: doc.pdfSubject,
        keywords: doc.pdfKeywords,
        creator: doc.pdfCreator,
        producer: doc.pdfProducer
      }
    })
  }
  return webpageSearchFields({
    url: doc.url,
    title: doc.title,
    htmlSnapshot: doc.body
  })
}

export async function runTypesenseSearch(
  orgId: string,
  params: GlobalSearchParams
): Promise<GlobalSearchResponse> {
  const client = getTypesenseClient()
  if (!client) throw new TypesenseUnavailableError()

  const query = normalizeSearchQuery(params.q)
  const mode = params.mode
  const type = params.type
  const page = Math.max(1, Number(params.page) || 1)
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Number(params.perPage) || DEFAULT_PER_PAGE))

  if (query.length < MIN_QUERY_LENGTH) {
    throw new Error(`Search query must be at least ${MIN_QUERY_LENGTH} characters`)
  }

  const filterBy = buildSearchFilter(orgId, params.siteId, type)

  if (mode === 'regex') {
    return runRegexSearch(client, {
      query,
      mode,
      filterBy,
      page,
      perPage
    })
  }

  if (isUrlLikeQuery(query)) {
    return runUrlAwareSearch(client, {
      query,
      mode,
      filterBy,
      page,
      perPage
    })
  }

  const searchParams: Record<string, unknown> = {
    q: typesenseQueryForMode(query, mode),
    query_by: QUERY_BY,
    filter_by: filterBy,
    per_page: perPage,
    page,
    highlight_full_fields: 'body,title',
    // Only fields with `infix: true` in the collection schema may use infix search.
    infix: mode === 'contains' ? 'always' : 'fallback'
  }
  if (mode === 'exact') {
    searchParams.drop_tokens_threshold = 0
  }

  const result = await client.collections(SEARCH_COLLECTION).documents().search(searchParams)
  const hits = result.hits ?? []
  const items = hits.map((hit) => {
    const doc = hit.document as IndexedSearchDocument
    const highlight = snippetFromHighlight(
      hit.highlights as Array<{ field?: string, snippet?: string, snippets?: string[] }>,
      doc
    )
    if (highlight) {
      return mapDocumentToResult(doc, highlight.matchedIn, highlight.snippet)
    }
    return mapDocumentToResult(doc, doc.type === 'pdf' ? 'PDF body' : 'HTML', doc.title || doc.url)
  })

  const totalItems = Number(result.found ?? items.length)
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage))

  return {
    items,
    page,
    perPage,
    totalItems,
    totalPages
  }
}

async function runUrlAwareSearch(
  client: NonNullable<ReturnType<typeof getTypesenseClient>>,
  input: {
    query: string
    mode: SearchMode
    filterBy: string
    page: number
    perPage: number
  }
): Promise<GlobalSearchResponse> {
  const token = typesenseTokenForUrlQuery(input.query)
  const matches: GlobalSearchResultItem[] = []
  let truncated = false
  let scanned = 0
  let searchPage = 1

  for (;;) {
    const result = await client.collections(SEARCH_COLLECTION).documents().search({
      q: token,
      query_by: QUERY_BY,
      filter_by: input.filterBy,
      per_page: 250,
      page: searchPage,
      infix: 'always',
      highlight_full_fields: 'body,title,url'
    })
    const hits = result.hits ?? []
    if (!hits.length) break

    for (const hit of hits) {
      scanned += 1
      if (scanned > MAX_SCAN_RECORDS) {
        truncated = true
        break
      }

      const doc = hit.document as IndexedSearchDocument
      const fields = searchableFieldsForDoc(doc)
      let matchedField: { key: string, label: string, value: string } | null = null
      let matchIndex: number | null = null

      for (const field of fields) {
        const passes = input.mode === 'exact'
          ? urlQueryMatchesInText(input.query, field.value)
          : urlQueryMatchesInText(input.query, field.value)
            || field.value.toLowerCase().includes(token.toLowerCase())
        if (!passes) continue
        const idx = findUrlMatchIndex(input.query, field.value)
        if (idx != null) {
          matchedField = field
          matchIndex = idx
          break
        }
      }

      if (!matchedField || matchIndex == null) continue

      const highlight = snippetFromHighlight(
        hit.highlights as Array<{ field?: string, snippet?: string, snippets?: string[] }>,
        doc
      )
      if (highlight) {
        matches.push(mapDocumentToResult(doc, highlight.matchedIn, highlight.snippet))
      } else {
        matches.push(mapDocumentToResult(
          doc,
          matchedField.label,
          buildSnippet(matchedField.value, matchIndex)
        ))
      }
    }

    if (truncated || hits.length < 250) break
    searchPage += 1
  }

  matches.sort((a, b) => a.url.localeCompare(b.url))
  const totalItems = matches.length
  const totalPages = Math.max(1, Math.ceil(totalItems / input.perPage))
  const start = (input.page - 1) * input.perPage
  const items = matches.slice(start, start + input.perPage)

  return {
    items,
    page: input.page,
    perPage: input.perPage,
    totalItems,
    totalPages,
    truncated: truncated || undefined,
    message: truncated
      ? 'Too many records to scan. Narrow your query or select a specific site.'
      : undefined
  }
}

async function runRegexSearch(
  client: NonNullable<ReturnType<typeof getTypesenseClient>>,
  input: {
    query: string
    mode: SearchMode
    filterBy: string
    page: number
    perPage: number
  }
): Promise<GlobalSearchResponse> {
  const matches: GlobalSearchResultItem[] = []
  let truncated = false
  let scanned = 0
  let searchPage = 1

  for (;;) {
    const result = await client.collections(SEARCH_COLLECTION).documents().search({
      q: '*',
      query_by: 'url',
      filter_by: input.filterBy,
      per_page: 250,
      page: searchPage
    })
    const hits = result.hits ?? []
    if (!hits.length) break

    for (const hit of hits) {
      scanned += 1
      if (scanned > MAX_SCAN_RECORDS) {
        truncated = true
        break
      }
      const doc = hit.document as IndexedSearchDocument
      const fields = searchableFieldsForDoc(doc)
      const match = searchFields(fields, input.query, input.mode)
      if (!match) continue
      matches.push(mapDocumentToResult(
        doc,
        match.field.label,
        buildSnippet(match.field.value, match.index)
      ))
    }

    if (truncated || hits.length < 250) break
    searchPage += 1
  }

  matches.sort((a, b) => a.url.localeCompare(b.url))
  const totalItems = matches.length
  const totalPages = Math.max(1, Math.ceil(totalItems / input.perPage))
  const start = (input.page - 1) * input.perPage
  const items = matches.slice(start, start + input.perPage)

  return {
    items,
    page: input.page,
    perPage: input.perPage,
    totalItems,
    totalPages,
    truncated: truncated || undefined,
    message: truncated
      ? 'Too many records to scan. Narrow your query or select a specific site.'
      : undefined
  }
}

export function fallbackMatchForDoc(
  doc: IndexedSearchDocument,
  query: string,
  mode: SearchMode
): { matchedIn: string, snippet: string } | null {
  const fields = searchableFieldsForDoc(doc)
  const match = searchFields(fields, query, mode)
  if (!match) return null
  return {
    matchedIn: match.field.label,
    snippet: buildSnippet(match.field.value, match.index)
  }
}

export { findMatchIndex }
