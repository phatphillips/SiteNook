import { buildSearchableWebpageBody } from './outboundLinks.js'
import { BODY_MAX_CHARS } from './typesenseConfig.js'
import { normalizePageUrl } from './urlKey.js'

export interface SearchDocument {
  id: string
  orgId: string
  siteId: string
  siteName: string
  url: string
  urlKey: string
  type: 'webpage' | 'pdf'
  title: string
  body: string
  pdfAuthor?: string
  pdfSubject?: string
  pdfKeywords?: string
  pdfCreator?: string
  pdfProducer?: string
  lastScannedAt: number
  pageId?: string
  pdfDocumentId?: string
}

export function webpageDocId(pageId: string): string {
  return `webpage:${pageId}`
}

export function pdfDocId(pdfDocumentId: string): string {
  return `pdf:${pdfDocumentId}`
}

function capBody(text: string): string {
  return text.slice(0, BODY_MAX_CHARS)
}

function pdfMetaFields(metadata: Record<string, unknown> | undefined): Pick<
  SearchDocument,
  'pdfAuthor' | 'pdfSubject' | 'pdfKeywords' | 'pdfCreator' | 'pdfProducer'
> {
  if (!metadata) return {}
  const str = (key: string) => {
    const raw = metadata[key]
    if (raw == null) return undefined
    const value = String(raw).trim()
    return value || undefined
  }
  return {
    pdfAuthor: str('author'),
    pdfSubject: str('subject'),
    pdfKeywords: str('keywords'),
    pdfCreator: str('creator'),
    pdfProducer: str('producer')
  }
}

export function buildWebpageDocument(input: {
  pageId: string
  orgId: string
  siteId: string
  siteName: string
  url: string
  title?: string
  htmlSnapshot?: string
  outboundLinkUrls?: string[]
  lastScannedAt: number
}): SearchDocument {
  const urlKey = normalizePageUrl(input.url)
  return {
    id: webpageDocId(input.pageId),
    orgId: input.orgId,
    siteId: input.siteId,
    siteName: input.siteName,
    url: input.url,
    urlKey,
    type: 'webpage',
    title: input.title?.trim() || '',
    body: buildSearchableWebpageBody(input.htmlSnapshot || '', input.outboundLinkUrls ?? []),
    lastScannedAt: input.lastScannedAt,
    pageId: input.pageId
  }
}

export function buildPdfDocument(input: {
  pdfDocumentId: string
  orgId: string
  siteId: string
  siteName: string
  url?: string
  filename?: string
  documentTitle?: string
  textContent?: string
  metadata?: Record<string, unknown>
  lastScannedAt: number
}): SearchDocument {
  const url = input.url?.trim() || input.filename?.trim() || ''
  const urlKey = url ? normalizePageUrl(url) : `pdf:${input.pdfDocumentId}`
  return {
    id: pdfDocId(input.pdfDocumentId),
    orgId: input.orgId,
    siteId: input.siteId,
    siteName: input.siteName,
    url,
    urlKey,
    type: 'pdf',
    title: input.documentTitle?.trim() || input.filename?.trim() || '',
    body: capBody(input.textContent || ''),
    ...pdfMetaFields(input.metadata),
    lastScannedAt: input.lastScannedAt,
    pdfDocumentId: input.pdfDocumentId
  }
}

export function pageTimestampFromScan(
  scanCompletedAt?: string,
  scanCreated?: string,
  pageCreated?: string
): number {
  for (const raw of [scanCompletedAt, scanCreated, pageCreated]) {
    if (!raw) continue
    const ts = Date.parse(String(raw))
    if (Number.isFinite(ts)) return ts
  }
  return Date.now()
}

export function pdfTimestamp(validatedAt?: string, created?: string): number {
  for (const raw of [validatedAt, created]) {
    if (!raw) continue
    const ts = Date.parse(String(raw))
    if (Number.isFinite(ts)) return ts
  }
  return Date.now()
}
