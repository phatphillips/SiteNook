import type PocketBase from 'pocketbase'
import { pocketBaseFileUrl } from '../db/pocketbaseFileUrl.js'
import { hashPdfBuffer } from './pdfIdentity.js'

export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const PDF_FETCH_TIMEOUT_MS = 60_000

export interface PdfDocumentRecord {
  id: string
  site: string
  source?: string
  file?: string
  url?: string
  filename?: string
  inventory?: string
  content_hash?: string
}

function safePdfFilename(filename: string): string {
  const raw = filename.trim() || 'document.pdf'
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw.replace(/\+/g, ' '))
  } catch {
    // keep raw
  }
  const cleaned = decoded.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 180).trim() || 'document.pdf'
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`
}

/**
 * Persist a downloaded PDF onto the document record so the web preview proxy
 * can serve from PocketBase instead of re-fetching a crawl URL.
 * Also stores content_hash when provided so identical files can be deduped.
 */
export async function persistPdfFileIfMissing(
  pb: PocketBase,
  doc: PdfDocumentRecord,
  buffer: Buffer,
  filename: string,
  contentHash?: string
): Promise<boolean> {
  if (doc.file) {
    if (contentHash && !doc.content_hash) {
      await pb.collection('pdf_documents').update(doc.id, { content_hash: contentHash })
      doc.content_hash = contentHash
    }
    return false
  }
  const form = new FormData()
  form.append(
    'file',
    new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }),
    safePdfFilename(filename)
  )
  if (!doc.filename) {
    form.append('filename', safePdfFilename(filename))
  }
  const hash = contentHash || hashPdfBuffer(buffer)
  form.append('content_hash', hash)
  await pb.collection('pdf_documents').update(doc.id, form)
  doc.file = safePdfFilename(filename)
  doc.content_hash = hash
  return true
}

export async function downloadPdfBuffer(
  pb: PocketBase,
  doc: PdfDocumentRecord
): Promise<{ buffer: Buffer, filename: string }> {
  if (doc.file) {
    const record = await pb.collection('pdf_documents').getOne(doc.id)
    const fileName = String((record as { file?: string }).file ?? doc.file)
    const url = pocketBaseFileUrl(pb, record, fileName)
    const token = pb.authStore.token
    const response = await fetch(url, {
      headers: token ? { Authorization: token } : {},
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS)
    })
    if (!response.ok) {
      throw new Error(`Failed to download uploaded PDF (${response.status})`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length > MAX_PDF_BYTES) {
      throw new Error('PDF exceeds 20MB limit')
    }
    return { buffer, filename: doc.filename || fileName || 'document.pdf' }
  }

  if (doc.url) {
    const response = await fetch(doc.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'SiteNook-PDF-Scanner/1.0',
        Accept: 'application/pdf,*/*'
      }
    })
    if (!response.ok) {
      throw new Error(`Failed to download PDF from URL (${response.status})`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length > MAX_PDF_BYTES) {
      throw new Error('PDF exceeds 20MB limit')
    }
    const rawName = doc.filename || doc.url.split('/').pop() || 'document.pdf'
    const filename = safePdfFilename(rawName)
    return { buffer, filename }
  }

  throw new Error('PDF document has no file or URL')
}

/**
 * Download PDF bytes and automatically store them on the document when missing.
 * Used by crawl enqueue, search indexing, validation, and structure jobs.
 */
export async function downloadAndStorePdf(
  pb: PocketBase,
  doc: PdfDocumentRecord
): Promise<{ buffer: Buffer, filename: string, stored: boolean }> {
  const { buffer, filename } = await downloadPdfBuffer(pb, doc)
  const hash = hashPdfBuffer(buffer)
  const stored = await persistPdfFileIfMissing(pb, doc, buffer, filename, hash)
  return { buffer, filename, stored }
}
