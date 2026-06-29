import { randomBytes } from 'node:crypto'
import type PocketBase from 'pocketbase'
import { extractPdfMetadata } from './extractPdfMetadata.js'
import { mapVeraPdfReport } from './mapVeraPdfReport.js'
import { downloadPdfBuffer, type PdfDocumentRecord } from './pdfDownload.js'
import { validatePdfBuffer, validatePdfUrl } from './veraPdfClient.js'
import { indexPdfFromDocumentId } from '../search/searchIndexer.js'

export function generateShareToken(): string {
  return randomBytes(24).toString('base64url')
}

export async function validatePdfDocument(
  pb: PocketBase,
  documentId: string
): Promise<void> {
  const doc = await pb.collection('pdf_documents').getOne(documentId) as unknown as PdfDocumentRecord

  await pb.collection('pdf_documents').update(documentId, {
    status: 'processing',
    error_message: ''
  })

  try {
    const { buffer, filename } = await downloadPdfBuffer(pb, doc)
    const report = await validatePdfBuffer(buffer, filename)
    const mapped = mapVeraPdfReport(report)

    const existingIssues = await pb.collection('pdf_issues').getFullList({
      filter: `pdf_document = "${documentId}"`
    })
    for (const issue of existingIssues) {
      await pb.collection('pdf_issues').delete(issue.id)
    }

    for (const issue of mapped.issues) {
      await pb.collection('pdf_issues').create({
        pdf_document: documentId,
        category: issue.category,
        rule_id: issue.rule_id,
        title: issue.title,
        description: issue.description ?? '',
        severity: issue.severity,
        page_number: issue.page_number,
        occurrence_count: issue.occurrence_count,
        evidence: issue.evidence ?? {}
      })
    }

    const titleFromFilename = filename.replace(/\.pdf$/i, '')
    const extracted = await extractPdfMetadata(buffer, {
      hasPdfTags: mapped.hasPdfTags,
      machineReadable: mapped.machineReadable,
      pdfUa: mapped.compliant
    })
    await pb.collection('pdf_documents').update(documentId, {
      status: 'complete',
      machine_readable: mapped.machineReadable,
      has_pdf_tags: mapped.hasPdfTags,
      issue_count: mapped.issueCount,
      accessibility_score: mapped.accessibilityScore,
      document_title: mapped.documentTitle || titleFromFilename || 'Unknown',
      validated_at: new Date().toISOString(),
      report_summary: {
        compliant: mapped.compliant,
        issueCount: mapped.issueCount,
        profile: 'ua1'
      },
      pdf_metadata: extracted.metadata,
      text_content: extracted.textContent,
      error_message: ''
    })

    if (doc.inventory) {
      await pb.collection('qa_inventory').update(doc.inventory, {
        pdf_accessibility_score: mapped.accessibilityScore
      })
    }

    void indexPdfFromDocumentId(pb, documentId).catch(indexErr => {
      console.warn(`Search index failed for PDF ${documentId}:`, indexErr instanceof Error ? indexErr.message : indexErr)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await pb.collection('pdf_documents').update(documentId, {
      status: 'failed',
      error_message: message
    })
    throw err
  }
}

export async function validatePdfDocumentByUrl(
  pb: PocketBase,
  documentId: string,
  url: string,
  fileSizeBytes?: number
): Promise<void> {
  const doc = await pb.collection('pdf_documents').getOne(documentId) as unknown as PdfDocumentRecord

  await pb.collection('pdf_documents').update(documentId, {
    status: 'processing',
    error_message: ''
  })

  try {
    let buffer: Buffer | null = null
    let report
    try {
      report = await validatePdfUrl(url, fileSizeBytes)
    } catch {
      const downloaded = await downloadPdfBuffer(pb, { ...doc, url })
      buffer = downloaded.buffer
      report = await validatePdfBuffer(downloaded.buffer, downloaded.filename)
    }

    const mapped = mapVeraPdfReport(report)

    if (!buffer) {
      const downloaded = await downloadPdfBuffer(pb, { ...doc, url })
      buffer = downloaded.buffer
    }
    const extracted = await extractPdfMetadata(buffer, {
      hasPdfTags: mapped.hasPdfTags,
      machineReadable: mapped.machineReadable,
      pdfUa: mapped.compliant
    })

    const existingIssues = await pb.collection('pdf_issues').getFullList({
      filter: `pdf_document = "${documentId}"`
    })
    for (const issue of existingIssues) {
      await pb.collection('pdf_issues').delete(issue.id)
    }

    for (const issue of mapped.issues) {
      await pb.collection('pdf_issues').create({
        pdf_document: documentId,
        category: issue.category,
        rule_id: issue.rule_id,
        title: issue.title,
        description: issue.description ?? '',
        severity: issue.severity,
        page_number: issue.page_number,
        occurrence_count: issue.occurrence_count,
        evidence: issue.evidence ?? {}
      })
    }

    await pb.collection('pdf_documents').update(documentId, {
      status: 'complete',
      machine_readable: mapped.machineReadable,
      has_pdf_tags: mapped.hasPdfTags,
      issue_count: mapped.issueCount,
      accessibility_score: mapped.accessibilityScore,
      document_title: mapped.documentTitle || doc.filename || 'Unknown',
      validated_at: new Date().toISOString(),
      report_summary: {
        compliant: mapped.compliant,
        issueCount: mapped.issueCount,
        profile: 'ua1'
      },
      pdf_metadata: extracted.metadata,
      text_content: extracted.textContent,
      error_message: ''
    })

    if (doc.inventory) {
      await pb.collection('qa_inventory').update(doc.inventory, {
        pdf_accessibility_score: mapped.accessibilityScore
      })
    }

    void indexPdfFromDocumentId(pb, documentId).catch(indexErr => {
      console.warn(`Search index failed for PDF ${documentId}:`, indexErr instanceof Error ? indexErr.message : indexErr)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await pb.collection('pdf_documents').update(documentId, {
      status: 'failed',
      error_message: message
    })
    throw err
  }
}
