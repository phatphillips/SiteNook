import type { PdfDocument, PdfDocumentStatus } from '~/types/accessiq'

export function pdfStatusLabel(status?: PdfDocumentStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'processing':
      return 'Processing'
    case 'complete':
      return 'Validated'
    case 'failed':
      return 'Failed'
    default:
      return 'Unknown'
  }
}

export function pdfValidationResultLabel(doc: Pick<PdfDocument, 'status' | 'issue_count'>): string {
  if (doc.status === 'pending' || doc.status === 'processing') {
    return doc.status === 'processing' ? 'Validating…' : 'Queued'
  }
  if (doc.status === 'failed') return 'Validation failed'
  if ((doc.issue_count ?? 0) > 0) return 'Issues found'
  return 'No issues'
}

export function pdfValidationResultColor(
  doc: Pick<PdfDocument, 'status' | 'issue_count'>
): 'error' | 'success' | 'warning' | 'neutral' {
  if (doc.status === 'failed') return 'error'
  if (doc.status === 'pending' || doc.status === 'processing') return 'warning'
  if ((doc.issue_count ?? 0) > 0) return 'error'
  return 'success'
}

export function pdfCheckPassed(value?: boolean, status?: PdfDocumentStatus): boolean | null {
  if (status !== 'complete') return null
  return value === true
}
