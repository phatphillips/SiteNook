import type PocketBase from 'pocketbase'

export const MAX_PDF_BYTES = 20 * 1024 * 1024

export interface PdfDocumentRecord {
  id: string
  site: string
  source?: string
  file?: string
  url?: string
  filename?: string
  inventory?: string
}

export async function downloadPdfBuffer(
  pb: PocketBase,
  doc: PdfDocumentRecord
): Promise<{ buffer: Buffer, filename: string }> {
  if (doc.source === 'upload' && doc.file) {
    const record = await pb.collection('pdf_documents').getOne(doc.id)
    const fileName = String((record as { file?: string }).file ?? doc.file)
    const url = pb.files.getUrl(record, fileName)
    const token = pb.authStore.token
    const response = await fetch(url, {
      headers: token ? { Authorization: token } : {}
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
    const response = await fetch(doc.url, { redirect: 'follow' })
    if (!response.ok) {
      throw new Error(`Failed to download PDF from URL (${response.status})`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length > MAX_PDF_BYTES) {
      throw new Error('PDF exceeds 20MB limit')
    }
    const filename = doc.filename || doc.url.split('/').pop() || 'document.pdf'
    return { buffer, filename }
  }

  throw new Error('PDF document has no file or URL')
}
