import type PocketBase from 'pocketbase'
import { extractPdfMetadata } from './extractPdfMetadata.js'
import { downloadAndStorePdf, type PdfDocumentRecord } from './pdfDownload.js'
import { indexPdfFromDocumentId } from '../search/searchIndexer.js'

interface PdfDocumentSearchRecord extends PdfDocumentRecord {
  text_content?: string
  document_title?: string
  has_pdf_tags?: boolean
  machine_readable?: boolean
  report_summary?: { compliant?: boolean }
}

export function pdfNeedsSearchIndexing(doc: { text_content?: string | null }): boolean {
  return !String(doc.text_content ?? '').trim()
}

/** Download a PDF (store file if missing) and persist searchable text + metadata (no VeraPDF validation). */
export async function indexPdfSearchContent(
  pb: PocketBase,
  documentId: string
): Promise<boolean> {
  const doc = await pb.collection('pdf_documents').getOne(documentId) as unknown as PdfDocumentSearchRecord

  // Nothing to do when text is indexed and the file is already stored.
  if (!pdfNeedsSearchIndexing(doc) && doc.file) {
    return false
  }

  const { buffer, filename, stored } = await downloadAndStorePdf(pb, doc)

  if (!pdfNeedsSearchIndexing(doc)) {
    return stored
  }

  const extracted = await extractPdfMetadata(buffer, {
    hasPdfTags: doc.has_pdf_tags,
    machineReadable: doc.machine_readable,
    pdfUa: doc.report_summary?.compliant === true
  })

  const titleFromFilename = filename.replace(/\.pdf$/i, '')
  const payload: Record<string, unknown> = {
    pdf_metadata: extracted.metadata,
    text_content: extracted.textContent,
    document_title: doc.document_title || extracted.metadata.title || titleFromFilename || undefined
  }
  try {
    await pb.collection('pdf_documents').update(documentId, payload)
  } catch (err) {
    console.warn(
      `PDF search text rejected for ${documentId}, retrying without text_content:`,
      err instanceof Error ? err.message : err
    )
    await pb.collection('pdf_documents').update(documentId, {
      ...payload,
      text_content: ''
    })
  }

  void indexPdfFromDocumentId(pb, documentId).catch(err => {
    console.warn(`Search index failed for PDF ${documentId}:`, err instanceof Error ? err.message : err)
  })

  return true
}
