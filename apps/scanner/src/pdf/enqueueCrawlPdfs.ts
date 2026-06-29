import type PocketBase from 'pocketbase'
import { indexPdfSearchContent } from './indexPdfSearchContent.js'
import { generateShareToken } from './validatePdfDocument.js'

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

async function findExistingCrawlDocument(
  pb: PocketBase,
  siteId: string,
  url: string
): Promise<string | null> {
  try {
    const existing = await pb.collection('pdf_documents').getList(1, 1, {
      filter: `site = "${siteId}" && source = "crawl" && url = "${url.replace(/"/g, '\\"')}"`
    })
    return existing.items[0]?.id ?? null
  } catch {
    return null
  }
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
  const url = String(row.url ?? '').trim()
  if (!url) return null

  let documentId = await findExistingCrawlDocument(pb, siteId, url)
  if (!documentId) {
    const created = await pb.collection('pdf_documents').create({
      site: siteId,
      source: 'crawl',
      url,
      inventory: row.id,
      filename: url.split('/').pop() || 'document.pdf',
      status: 'pending',
      share_token: generateShareToken()
    })
    documentId = created.id
  }

  return documentId
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

  let enqueued = 0
  for (const row of inventoryRows) {
    let documentId: string | null
    try {
      documentId = await ensureCrawlPdfDocument(pb, siteId, row)
    } catch (err) {
      console.warn('Failed to ensure crawl PDF document:', err)
      continue
    }
    if (!documentId) continue

    try {
      const indexed = await indexPdfSearchContent(pb, documentId)
      if (indexed) {
        console.log(`Indexed PDF search content for ${row.url}`)
      }
    } catch (err) {
      console.warn(`Failed to index PDF search content for ${row.url}:`, err)
    }

    if (!queueValidation) continue

    const pending = await pb.collection('pdf_validation_queue').getList(1, 1, {
      filter: `pdf_document = "${documentId}" && (status = "pending" || status = "processing")`
    })
    if (pending.items.length > 0) continue

    const doc = await pb.collection('pdf_documents').getOne(documentId)
    if (String((doc as { status?: string }).status) === 'complete') continue

    await enqueuePdfValidation(pb, documentId, CRAWL_PRIORITY)
    enqueued += 1
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
