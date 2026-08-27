import type { PdfDocument } from '~/types/sitenook'
import { format } from 'date-fns'
import { buildCsv } from '~/utils/csvExport'

export function buildPdfDocumentsCsv(documents: PdfDocument[]): string {
  const headers = [
    'PDF title',
    'Filename',
    'Source',
    'Uploaded on',
    'Machine-readable',
    'PDF tags',
    'Accessibility issues',
    'Status',
    'Score'
  ]

  const rows = documents.map((doc) => {
    const uploadedOn = doc.validated_at || doc.created
    const dateLabel = uploadedOn
      ? format(new Date(uploadedOn), 'yyyy-MM-dd HH:mm')
      : ''
    return [
      doc.document_title || 'Unknown',
      doc.filename || '',
      doc.source,
      dateLabel,
      doc.machine_readable ? 'Yes' : 'No',
      doc.has_pdf_tags ? 'Yes' : 'No',
      String(doc.issue_count ?? 0),
      doc.status,
      doc.accessibility_score != null ? String(doc.accessibility_score) : ''
    ]
  })

  return buildCsv(headers, rows.map(row => row.map(String)))
}