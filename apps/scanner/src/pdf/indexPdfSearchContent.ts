import type PocketBase from 'pocketbase'
import { extractPdfMetadata } from './extractPdfMetadata.js'
import { downloadPdfBuffer, type PdfDocumentRecord } from './pdfDownload.js'
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

/** Download a PDF and persist searchable text + metadata (no VeraPDF validation). */
export async function indexPdfSearchContent(
  pb: PocketBase,
  documentId: string
): Promise<boolean> {
  const doc = await pb.collection('pdf_documents').getOne(documentId) as unknown as PdfDocumentSearchRecord

  if (!pdfNeedsSearchIndexing(doc)) {
    return false
  }

  const { buffer, filename } = await downloadPdfBuffer(pb, doc)
  const extracted = await extractPdfMetadata(buffer, {
    hasPdfTags: doc.has_pdf_tags,
    machineReadable: doc.machine_readable,
    pdfUa: doc.report_summary?.compliant === true
  })

  const titleFromFilename = filename.replace(/\.pdf$/i, '')
  await pb.collection('pdf_documents').update(documentId, {
    pdf_metadata: extracted.metadata,
    text_content: extracted.textContent,
    document_title: doc.document_title || extracted.metadata.title || titleFromFilename || undefined
  })

  void indexPdfFromDocumentId(pb, documentId).catch(err => {
    console.warn(`Search index failed for PDF ${documentId}:`, err instanceof Error ? err.message : err)
  })

  return true
}
