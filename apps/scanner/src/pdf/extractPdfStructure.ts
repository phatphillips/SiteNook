import type PocketBase from 'pocketbase'
import { convertPdfStructure } from './opendataloaderClient.js'
import { downloadAndStorePdf, type PdfDocumentRecord } from './pdfDownload.js'
import { buildStructureOutline } from './structureOutline.js'

function textBlob(content: string, mime: string): Blob {
  return new Blob([content], { type: mime })
}

export async function extractPdfStructure(pb: PocketBase, documentId: string): Promise<void> {
  const doc = await pb.collection('pdf_documents').getOne(documentId) as unknown as PdfDocumentRecord & {
    structure_status?: string
  }

  await pb.collection('pdf_documents').update(documentId, {
    structure_status: 'processing',
    structure_error: ''
  })

  try {
    const { buffer, filename } = await downloadAndStorePdf(pb, doc)
    const result = await convertPdfStructure(buffer, filename, 'json,html,markdown')
    const outline = buildStructureOutline(result.json)
    const stem = (filename || 'document').replace(/\.pdf$/i, '') || 'document'

    const form = new FormData()
    form.append('structure_status', 'complete')
    form.append('structure_extracted_at', new Date().toISOString())
    form.append('structure_error', '')
    form.append('structure_outline', JSON.stringify(outline))
    if (result.json) {
      form.append('structure_json', textBlob(result.json, 'application/json'), `${stem}.json`)
    }
    if (result.html) {
      form.append('structure_html', textBlob(result.html, 'text/html'), `${stem}.html`)
    }
    if (result.markdown) {
      form.append('structure_markdown', textBlob(result.markdown, 'text/markdown'), `${stem}.md`)
    }

    await pb.collection('pdf_documents').update(documentId, form)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await pb.collection('pdf_documents').update(documentId, {
      structure_status: 'failed',
      structure_error: message.slice(0, 4000)
    })
    throw err
  }
}
