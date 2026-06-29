export type SearchMode = 'contains' | 'exact' | 'regex'
export type SearchContentType = 'all' | 'webpages' | 'pdfs'

export interface SearchableField {
  key: string
  label: string
  value: string
}

export interface GlobalSearchResultItem {
  id: string
  siteId: string
  siteName: string
  url: string
  type: 'webpage' | 'pdf'
  matchedIn: string
  snippet: string
  lastScannedAt: string | null
  pdfDocumentId?: string
}

export interface GlobalSearchResponse {
  items: GlobalSearchResultItem[]
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  truncated?: boolean
  message?: string
}

export interface GlobalSearchParams {
  q: string
  mode: SearchMode
  type: SearchContentType
  siteId?: string
  page?: number
  perPage?: number
}
