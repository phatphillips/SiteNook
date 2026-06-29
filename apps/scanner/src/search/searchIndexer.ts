import type PocketBase from 'pocketbase'
import { getPocketBase } from '../db/pocketbaseClient.js'
import { isTypesenseEnabled, SEARCH_COLLECTION } from './typesenseConfig.js'
import { ensureSearchCollection, getTypesenseClient } from './typesenseClient.js'
import {
  buildPdfDocument,
  buildWebpageDocument,
  pageTimestampFromScan,
  pdfDocId,
  pdfTimestamp,
  webpageDocId,
  type SearchDocument
} from './searchDocument.js'
import { extractHrefUrlsFromHtml, mergeOutboundLinkUrls } from './outboundLinks.js'
import { normalizePageUrl } from './urlKey.js'

const siteMetaCache = new Map<string, { orgId: string, siteName: string }>()

async function resolveSiteMeta(
  pb: PocketBase,
  siteId: string
): Promise<{ orgId: string, siteName: string } | null> {
  const cached = siteMetaCache.get(siteId)
  if (cached) return cached

  try {
    const site = await pb.collection('sites').getOne(siteId, {
      fields: 'organization,name'
    }) as { organization?: string, name?: string }
    const orgId = String(site.organization ?? '').trim()
    if (!orgId) return null
    const meta = { orgId, siteName: String(site.name ?? 'Unknown site') }
    siteMetaCache.set(siteId, meta)
    return meta
  } catch (err) {
    console.warn(`Search index: could not load site ${siteId}:`, err instanceof Error ? err.message : err)
    return null
  }
}

async function upsertDocument(doc: SearchDocument): Promise<void> {
  if (!isTypesenseEnabled()) return
  await ensureSearchCollection()
  const client = getTypesenseClient()
  if (!client) return
  await client.collections(SEARCH_COLLECTION).documents().upsert(doc)
}

export async function deleteSearchDocuments(ids: string[]): Promise<void> {
  if (!isTypesenseEnabled() || !ids.length) return
  const client = getTypesenseClient()
  if (!client) return
  await Promise.all(ids.map(id =>
    client.collections(SEARCH_COLLECTION).documents(id).delete().catch(() => undefined)
  ))
}

export async function deleteWebpageSearchDocsByPageIds(pageIds: string[]): Promise<void> {
  await deleteSearchDocuments(pageIds.map(webpageDocId))
}

export async function deletePdfSearchDoc(pdfDocumentId: string): Promise<void> {
  await deleteSearchDocuments([pdfDocId(pdfDocumentId)])
}

export async function deleteSearchDocsForSite(siteId: string): Promise<void> {
  if (!isTypesenseEnabled()) return
  const client = getTypesenseClient()
  if (!client) return
  await ensureSearchCollection()

  let page = 1
  for (;;) {
    const result = await client.collections(SEARCH_COLLECTION).documents().search({
      q: '*',
      query_by: 'url',
      filter_by: `siteId:=${escapeFilterValue(siteId)}`,
      per_page: 250,
      page
    })
    const hits = result.hits ?? []
    if (!hits.length) break
    await deleteSearchDocuments(hits.map(hit => String((hit.document as { id: string }).id)))
    if (hits.length < 250) break
    page += 1
  }
}

function escapeFilterValue(value: string): string {
  return `\`${value.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``
}

export async function loadOutboundUrlsByPageIds(
  pb: PocketBase,
  pages: Array<{ id: string, url: string, html_snapshot?: string }>
): Promise<Map<string, string[]>> {
  const byPageId = new Map<string, string[]>()
  if (!pages.length) return byPageId

  for (const page of pages) {
    byPageId.set(page.id, mergeOutboundLinkUrls(
      extractHrefUrlsFromHtml(page.html_snapshot ?? '', page.url)
    ))
  }

  const pageIds = pages.map(page => page.id)
  const CHUNK = 40
  for (let i = 0; i < pageIds.length; i += CHUNK) {
    const chunk = pageIds.slice(i, i + CHUNK)
    const filter = chunk.map(id => `page = "${id}"`).join(' || ')
    try {
      const links = await pb.collection('qa_broken_links').getFullList({
        filter,
        fields: 'page,href'
      }) as Array<{ page?: string, href?: string }>
      for (const link of links) {
        const pageId = String(link.page ?? '')
        const href = String(link.href ?? '').trim()
        if (!pageId || !href) continue
        const existing = byPageId.get(pageId) ?? []
        byPageId.set(pageId, mergeOutboundLinkUrls(existing, [href]))
      }
    } catch (err) {
      console.warn('Search index: could not load outbound links:', err instanceof Error ? err.message : err)
    }
  }

  return byPageId
}

export async function indexWebpageFromPage(
  pb: PocketBase,
  input: {
    pageId: string
    siteId: string
    url: string
    title?: string
    htmlSnapshot?: string
    outboundLinkUrls?: string[]
    scanCompletedAt?: string
    scanCreated?: string
    pageCreated?: string
  }
): Promise<void> {
  if (!isTypesenseEnabled()) return
  const meta = await resolveSiteMeta(pb, input.siteId)
  if (!meta) return

  const outboundLinkUrls = mergeOutboundLinkUrls(
    input.outboundLinkUrls,
    extractHrefUrlsFromHtml(input.htmlSnapshot ?? '', input.url)
  )

  const doc = buildWebpageDocument({
    pageId: input.pageId,
    orgId: meta.orgId,
    siteId: input.siteId,
    siteName: meta.siteName,
    url: input.url,
    title: input.title,
    htmlSnapshot: input.htmlSnapshot,
    outboundLinkUrls,
    lastScannedAt: pageTimestampFromScan(input.scanCompletedAt, input.scanCreated, input.pageCreated)
  })
  await upsertDocument(doc)
}

export async function indexPdfFromRecord(
  pb: PocketBase,
  doc: {
    id: string
    site: string
    url?: string
    filename?: string
    document_title?: string
    text_content?: string
    pdf_metadata?: Record<string, unknown>
    validated_at?: string
    created?: string
  }
): Promise<void> {
  if (!isTypesenseEnabled()) return
  const meta = await resolveSiteMeta(pb, doc.site)
  if (!meta) return

  const searchDoc = buildPdfDocument({
    pdfDocumentId: doc.id,
    orgId: meta.orgId,
    siteId: doc.site,
    siteName: meta.siteName,
    url: doc.url,
    filename: doc.filename,
    documentTitle: doc.document_title,
    textContent: doc.text_content,
    metadata: doc.pdf_metadata,
    lastScannedAt: pdfTimestamp(doc.validated_at, doc.created)
  })
  await upsertDocument(searchDoc)
}

export async function indexPdfFromDocumentId(pb: PocketBase, documentId: string): Promise<void> {
  if (!isTypesenseEnabled()) return
  try {
    const doc = await pb.collection('pdf_documents').getOne(documentId, {
      fields: 'id,site,url,filename,document_title,text_content,pdf_metadata,validated_at,created'
    }) as {
      id: string
      site: string
      url?: string
      filename?: string
      document_title?: string
      text_content?: string
      pdf_metadata?: Record<string, unknown>
      validated_at?: string
      created?: string
    }
    await indexPdfFromRecord(pb, doc)
  } catch (err) {
    console.warn(`Search index: PDF ${documentId} failed:`, err instanceof Error ? err.message : err)
  }
}

interface PageRow {
  id: string
  site: string
  url: string
  title?: string
  html_snapshot?: string
  created?: string
  expand?: {
    scan?: {
      completed_at?: string
      created?: string
    }
  }
}

function pageRowTimestamp(page: PageRow): number {
  const scan = page.expand?.scan
  return pageTimestampFromScan(scan?.completed_at, scan?.created, page.created)
}

export async function loadLatestPagesPerUrlKey(
  pb: PocketBase,
  siteId: string
): Promise<PageRow[]> {
  const pages = await pb.collection('pages').getFullList({
    filter: `site = "${siteId}"`,
    expand: 'scan',
    fields: 'id,site,url,title,html_snapshot,created'
  }) as unknown as PageRow[]

  const latestByKey = new Map<string, PageRow>()
  for (const page of pages) {
    const key = normalizePageUrl(page.url)
    const existing = latestByKey.get(key)
    if (!existing || pageRowTimestamp(page) >= pageRowTimestamp(existing)) {
      latestByKey.set(key, page)
    }
  }
  return [...latestByKey.values()]
}

/** After scan completes, upsert latest pages per URL and remove stale webpage docs for the site. */
export async function reconcileSiteWebpageSearchIndex(siteId: string): Promise<void> {
  if (!isTypesenseEnabled()) return
  const pb = getPocketBase()
  const latestPages = await loadLatestPagesPerUrlKey(pb, siteId)
  const latestPageIds = new Set(latestPages.map(page => page.id))
  const outboundByPage = await loadOutboundUrlsByPageIds(pb, latestPages.map(page => ({
    id: page.id,
    url: page.url,
    html_snapshot: page.html_snapshot
  })))

  for (const page of latestPages) {
    await indexWebpageFromPage(pb, {
      pageId: page.id,
      siteId: page.site,
      url: page.url,
      title: page.title,
      htmlSnapshot: page.html_snapshot,
      outboundLinkUrls: outboundByPage.get(page.id),
      scanCompletedAt: page.expand?.scan?.completed_at,
      scanCreated: page.expand?.scan?.created,
      pageCreated: page.created
    })
  }

  const client = getTypesenseClient()
  if (!client) return

  let searchPage = 1
  for (;;) {
    const result = await client.collections(SEARCH_COLLECTION).documents().search({
      q: '*',
      query_by: 'url',
      filter_by: `siteId:=${escapeFilterValue(siteId)} && type:=webpage`,
      per_page: 250,
      page: searchPage
    })
    const hits = result.hits ?? []
    if (!hits.length) break

    const staleIds: string[] = []
    for (const hit of hits) {
      const document = hit.document as { id?: string, pageId?: string }
      const pageId = String(document.pageId ?? '')
      if (!pageId || !latestPageIds.has(pageId)) {
        if (document.id) staleIds.push(document.id)
      }
    }
    if (staleIds.length) await deleteSearchDocuments(staleIds)

    if (hits.length < 250) break
    searchPage += 1
  }
}

export async function bulkImportSearchDocuments(docs: SearchDocument[]): Promise<void> {
  if (!isTypesenseEnabled() || !docs.length) return
  await ensureSearchCollection()
  const client = getTypesenseClient()
  if (!client) return

  const jsonl = docs.map(doc => JSON.stringify(doc)).join('\n')
  const result = await client.collections(SEARCH_COLLECTION).documents().import(jsonl, {
    action: 'upsert'
  })
  const failed = (Array.isArray(result) ? result : []).filter(
    (row: { success?: boolean }) => row.success === false
  )
  if (failed.length) {
    console.warn(`Search bulk import: ${failed.length} document(s) failed`)
  }
}

export function clearSiteMetaCacheForTests(): void {
  siteMetaCache.clear()
}
