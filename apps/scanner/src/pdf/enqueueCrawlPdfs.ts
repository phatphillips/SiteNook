import type PocketBase from 'pocketbase'
import { indexPdfSearchContent } from './indexPdfSearchContent.js'
import {
  downloadAndStorePdf,
  type PdfDocumentRecord
} from './pdfDownload.js'
import {
  hashPdfBuffer,
  normalizePdfCrawlUrl,
  pickPdfMergeWinner,
  shouldSkipPdfDownload,
  type PdfMergeCandidate
} from './pdfIdentity.js'

const UPLOAD_PRIORITY = 10
const CRAWL_PRIORITY = 5

interface InventoryPdfRow {
  id: string
  url: string
  size_bytes?: number
}

export interface EnqueueCrawlPdfsOptions {
  /** Queue VeraPDF accessibility validation (requires pdfAccessibility plan). */
  queueValidation?: boolean
}

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function findExistingCrawlDocument(
  pb: PocketBase,
  siteId: string,
  url: string
): Promise<string | null> {
  const normalized = normalizePdfCrawlUrl(url)
  if (!normalized) return null

  try {
    const exact = await pb.collection('pdf_documents').getList(1, 1, {
      filter: `site = "${escapeFilterValue(siteId)}" && source = "crawl" && url = "${escapeFilterValue(normalized)}"`
    })
    if (exact.items[0]?.id) return exact.items[0].id
  } catch {
    // fall through
  }

  // Legacy rows may store a non-normalized URL that normalizes to the same key.
  try {
    const candidates = await pb.collection('pdf_documents').getFullList({
      filter: `site = "${escapeFilterValue(siteId)}" && source = "crawl" && url != ""`,
      fields: 'id,url'
    }) as Array<{ id: string, url?: string }>
    const match = candidates.find(row => normalizePdfCrawlUrl(row.url || '') === normalized)
    return match?.id ?? null
  } catch {
    return null
  }
}

async function findDocumentByContentHash(
  pb: PocketBase,
  siteId: string,
  contentHash: string,
  excludeId?: string
): Promise<PdfMergeCandidate | null> {
  if (!contentHash) return null
  try {
    const filter = [
      `site = "${escapeFilterValue(siteId)}"`,
      `content_hash = "${escapeFilterValue(contentHash)}"`
    ]
    if (excludeId) filter.push(`id != "${escapeFilterValue(excludeId)}"`)
    const existing = await pb.collection('pdf_documents').getList(1, 5, {
      filter: filter.join(' && '),
      fields: 'id,file,status,content_hash,validated_at,created'
    })
    const items = existing.items as unknown as PdfMergeCandidate[]
    if (!items.length) return null
    return items.reduce((best, item) => pickPdfMergeWinner(best, item))
  } catch {
    return null
  }
}

/**
 * If another document already owns these bytes, merge into the winner and
 * delete the duplicate so the library shows one row and we download once.
 */
async function mergeDuplicateByHash(
  pb: PocketBase,
  siteId: string,
  documentId: string,
  contentHash: string
): Promise<string> {
  const other = await findDocumentByContentHash(pb, siteId, contentHash, documentId)
  if (!other) return documentId

  let current: PdfMergeCandidate
  try {
    current = await pb.collection('pdf_documents').getOne(documentId, {
      fields: 'id,file,status,content_hash,validated_at,created'
    }) as unknown as PdfMergeCandidate
  } catch {
    return other.id
  }

  const winner = pickPdfMergeWinner(current, other)
  const loserId = winner.id === current.id ? other.id : current.id
  if (loserId === winner.id) return winner.id

  try {
    // Prefer winner's file; copy inventory/url hints from loser when useful.
    const loser = await pb.collection('pdf_documents').getOne(loserId) as {
      url?: string
      inventory?: string
      filename?: string
      content_hash?: string
    }
    const winnerFull = await pb.collection('pdf_documents').getOne(winner.id) as {
      url?: string
      inventory?: string
      filename?: string
      content_hash?: string
      file?: string
    }
    const patch: Record<string, unknown> = {}
    if (!winnerFull.content_hash && contentHash) patch.content_hash = contentHash
    if (!winnerFull.url && loser.url) patch.url = normalizePdfCrawlUrl(loser.url)
    if (!winnerFull.inventory && loser.inventory) patch.inventory = loser.inventory
    if (!winnerFull.filename && loser.filename) patch.filename = loser.filename
    if (Object.keys(patch).length) {
      await pb.collection('pdf_documents').update(winner.id, patch)
    }
    await pb.collection('pdf_documents').delete(loserId)
    console.log(`Merged duplicate PDF ${loserId} into ${winner.id} (hash ${contentHash.slice(0, 12)}…)`)
  } catch (err) {
    console.warn('Failed to merge duplicate PDF documents:', err)
    return documentId
  }

  return winner.id
}

export async function enqueuePdfValidation(
  pb: PocketBase,
  documentId: string,
  priority = UPLOAD_PRIORITY
): Promise<string> {
  const queueItem = await pb.collection('pdf_validation_queue').create({
    pdf_document: documentId,
    status: 'pending',
    priority
  })
  return queueItem.id
}

async function ensureCrawlPdfDocument(
  pb: PocketBase,
  siteId: string,
  row: InventoryPdfRow
): Promise<string | null> {
  const url = normalizePdfCrawlUrl(row.url)
  if (!url) return null

  let documentId = await findExistingCrawlDocument(pb, siteId, url)
  if (!documentId) {
    const raw = url.split('/').pop() || 'document.pdf'
    let filename = raw
    try {
      filename = decodeURIComponent(raw.replace(/\+/g, ' '))
    } catch {
      // keep raw
    }
    const created = await pb.collection('pdf_documents').create({
      site: siteId,
      source: 'crawl',
      url,
      inventory: row.id,
      filename,
      status: 'pending'
    })
    documentId = created.id
  } else {
    // Keep inventory FK fresh across consolidations that recreate inventory rows.
    try {
      await pb.collection('pdf_documents').update(documentId, {
        inventory: row.id,
        url
      })
    } catch {
      // non-fatal
    }
  }

  return documentId
}

/** Download crawl PDF into PocketBase file storage so preview/structure do not re-hit the remote URL. */
async function ensureCrawlPdfFileStored(
  pb: PocketBase,
  documentId: string,
  url: string,
  siteId: string
): Promise<{ stored: boolean, documentId: string }> {
  const doc = await pb.collection('pdf_documents').getOne(documentId) as unknown as PdfDocumentRecord & {
    content_hash?: string
    status?: string
  }

  if (shouldSkipPdfDownload(doc) && doc.content_hash) {
    const mergedId = await mergeDuplicateByHash(pb, siteId, documentId, doc.content_hash)
    return { stored: false, documentId: mergedId }
  }

  const { stored, buffer, filename } = await downloadAndStorePdf(pb, doc)
  const hash = hashPdfBuffer(buffer)
  if (!doc.content_hash || doc.content_hash !== hash) {
    await pb.collection('pdf_documents').update(documentId, { content_hash: hash })
  }
  if (stored) {
    console.log(`Stored crawl PDF for preview: ${filename} (${url})`)
  }

  const mergedId = await mergeDuplicateByHash(pb, siteId, documentId, hash)
  return { stored, documentId: mergedId }
}

export async function enqueueCrawlPdfs(
  pb: PocketBase,
  siteId: string,
  scanId: string,
  options?: EnqueueCrawlPdfsOptions
): Promise<number> {
  const queueValidation = options?.queueValidation ?? true

  let inventoryRows: InventoryPdfRow[] = []
  try {
    inventoryRows = await pb.collection('qa_inventory').getFullList({
      filter: `scan = "${scanId}" && is_pdf = true`,
      fields: 'id,url,size_bytes'
    }) as unknown as InventoryPdfRow[]
  } catch {
    return 0
  }

  // Collapse inventory rows that normalize to the same URL before creating documents.
  const byNormalizedUrl = new Map<string, InventoryPdfRow>()
  for (const row of inventoryRows) {
    const key = normalizePdfCrawlUrl(row.url)
    if (!key) continue
    if (!byNormalizedUrl.has(key)) byNormalizedUrl.set(key, { ...row, url: key })
  }

  let enqueued = 0
  for (const row of byNormalizedUrl.values()) {
    let documentId: string | null
    try {
      documentId = await ensureCrawlPdfDocument(pb, siteId, row)
    } catch (err) {
      console.warn('Failed to ensure crawl PDF document:', err)
      continue
    }
    if (!documentId) continue

    try {
      const result = await ensureCrawlPdfFileStored(pb, documentId, row.url, siteId)
      documentId = result.documentId
    } catch (err) {
      console.warn(
        `Failed to download/store crawl PDF ${row.url}:`,
        err instanceof Error ? err.message : err
      )
    }

    try {
      const indexed = await indexPdfSearchContent(pb, documentId)
      if (indexed) {
        console.log(`Indexed PDF search content for ${row.url}`)
      }
    } catch (err) {
      console.warn(`Failed to index PDF search content for ${row.url}:`, err)
    }

    if (!queueValidation) continue

    try {
      const pending = await pb.collection('pdf_validation_queue').getList(1, 1, {
        filter: `pdf_document = "${documentId}" && (status = "pending" || status = "processing")`
      })
      if (pending.items.length > 0) continue

      const doc = await pb.collection('pdf_documents').getOne(documentId)
      if (Boolean((doc as { ignored?: boolean }).ignored)) continue
      if (String((doc as { status?: string }).status) === 'complete') continue

      await enqueuePdfValidation(pb, documentId, CRAWL_PRIORITY)
      enqueued += 1
    } catch (err) {
      console.warn(
        `Failed to enqueue PDF validation for ${row.url}:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  return enqueued
}

export async function requestPdfRevalidation(
  pb: PocketBase,
  documentId: string,
  priority = UPLOAD_PRIORITY
): Promise<void> {
  await pb.collection('pdf_documents').update(documentId, {
    status: 'pending',
    error_message: ''
  })
  await enqueuePdfValidation(pb, documentId, priority)
}
