import type { SearchMode, SearchableField } from '~/types/globalSearch'

export const MAX_REGEX_PATTERN_LENGTH = 200
export const MAX_SCAN_RECORDS = 2000
export const SNIPPET_RADIUS = 60
export const MIN_QUERY_LENGTH = 2
export const DEFAULT_PER_PAGE = 50
export const MAX_PER_PAGE = 100

/** Strip wrapping quotes users paste from PDF selections. */
export function normalizeSearchQuery(raw: string): string {
  const trimmed = raw.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export function buildSnippet(text: string, matchIndex: number, radius = SNIPPET_RADIUS): string {
  if (!text) return ''
  const safeIndex = Math.max(0, Math.min(matchIndex, text.length))
  const start = Math.max(0, safeIndex - radius)
  const end = Math.min(text.length, safeIndex + radius)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = `…${snippet}`
  if (end < text.length) snippet = `${snippet}…`
  return snippet.replace(/\s+/g, ' ').trim()
}

export function compileSearchRegex(pattern: string): RegExp {
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    throw new Error('Regex pattern is too long')
  }
  try {
    return new RegExp(pattern, 'i')
  } catch {
    throw new Error('Invalid regular expression')
  }
}

export function findMatchIndex(value: string, query: string, mode: SearchMode): number | null {
  if (!value || !query) return null

  if (mode === 'contains') {
    const idx = value.toLowerCase().indexOf(query.toLowerCase())
    return idx >= 0 ? idx : null
  }

  if (mode === 'exact') {
    if (value === query) return 0
    const idx = value.indexOf(query)
    return idx >= 0 ? idx : null
  }

  const regex = compileSearchRegex(query)
  const match = regex.exec(value)
  if (match && match.index != null) return match.index
  return null
}

export function searchFields(
  fields: SearchableField[],
  query: string,
  mode: SearchMode
): { field: SearchableField, index: number } | null {
  for (const field of fields) {
    const index = findMatchIndex(field.value, query, mode)
    if (index != null) {
      return { field, index }
    }
  }
  return null
}

const PDF_METADATA_LABELS: Record<string, string> = {
  title: 'PDF Title',
  author: 'PDF Author',
  subject: 'PDF Subject',
  keywords: 'PDF Keywords',
  creationDate: 'PDF Creation Date',
  modificationDate: 'PDF Modification Date',
  creator: 'PDF Creator',
  producer: 'PDF Producer',
  pdfVersion: 'PDF Version',
  pageCount: 'PDF Page Count',
  linearized: 'PDF Linearized',
  hasTags: 'PDF Tags',
  taggedForAccessibility: 'PDF Tagged',
  pdfUa: 'PDF/UA',
  pdfA: 'PDF/A'
}

export function flattenPdfMetadata(metadata: Record<string, unknown> | undefined): SearchableField[] {
  if (!metadata) return []
  const fields: SearchableField[] = []

  for (const [key, raw] of Object.entries(metadata)) {
    if (raw == null) continue
    if (key === 'pageDimensions' && Array.isArray(raw)) {
      const value = raw.map(item => JSON.stringify(item)).join(' ')
      if (value) {
        fields.push({ key, label: 'PDF Page Dimensions', value })
      }
      continue
    }
    const value = String(raw).trim()
    if (!value) continue
    fields.push({
      key,
      label: PDF_METADATA_LABELS[key] || `PDF ${key}`,
      value
    })
  }

  return fields
}

export function webpageSearchFields(input: {
  url: string
  title?: string
  htmlSnapshot?: string
}): SearchableField[] {
  const fields: SearchableField[] = [
    { key: 'url', label: 'URL', value: input.url }
  ]
  if (input.title) {
    fields.push({ key: 'title', label: 'Page title', value: input.title })
  }
  if (input.htmlSnapshot) {
    fields.push({ key: 'html_snapshot', label: 'HTML', value: input.htmlSnapshot })
  }
  return fields
}

export function pdfSearchFields(input: {
  url?: string
  filename?: string
  documentTitle?: string
  textContent?: string
  metadata?: Record<string, unknown>
}): SearchableField[] {
  const fields: SearchableField[] = []
  if (input.url) fields.push({ key: 'url', label: 'URL', value: input.url })
  if (input.filename) fields.push({ key: 'filename', label: 'Filename', value: input.filename })
  if (input.documentTitle) {
    fields.push({ key: 'document_title', label: 'Document title', value: input.documentTitle })
  }
  if (input.textContent) {
    fields.push({ key: 'text_content', label: 'PDF body', value: input.textContent })
  }
  fields.push(...flattenPdfMetadata(input.metadata))
  return fields
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Highlight the first case-insensitive query match in a snippet (HTML-safe). */
export function highlightSnippet(snippet: string, query: string): string {
  const text = snippet.trim()
  if (!text) return ''
  const needle = query.trim()
  if (!needle || needle.length < MIN_QUERY_LENGTH) return escapeHtml(text)

  const lower = text.toLowerCase()
  const idx = lower.indexOf(needle.toLowerCase())
  if (idx < 0) return escapeHtml(text)

  const before = escapeHtml(text.slice(0, idx))
  const match = escapeHtml(text.slice(idx, idx + needle.length))
  const after = escapeHtml(text.slice(idx + needle.length))
  return `${before}<mark class="search-snippet-mark">${match}</mark>${after}`
}
