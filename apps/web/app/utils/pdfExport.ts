import type { PdfDocument } from '~/types/accessiq'
import { format } from 'date-fns'

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

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
    ].map(cell => escapeCsv(cell))
  })

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
