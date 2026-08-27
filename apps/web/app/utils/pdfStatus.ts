import type { PdfDocument, PdfDocumentStatus } from '~/types/sitenook'

export function pdfStatusLabel(status?: PdfDocumentStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'processing':
      return 'Scanning'
    case 'complete':
      return 'Scanned'
    case 'failed':
      return 'Failed'
    default:
      return 'Unknown'
  }
}

export function pdfValidationResultLabel(
  doc: Pick<PdfDocument, 'status' | 'issue_count' | 'ignored'>
): string {
  if (doc.ignored) return 'Ignored'
  if (doc.status === 'pending' || doc.status === 'processing') {
    return doc.status === 'processing' ? 'Scanning…' : 'Queued'
  }
  if (doc.status === 'failed') return 'Scan failed'
  if ((doc.issue_count ?? 0) > 0) return 'Issues found'
  return 'No issues'
}

/** Plain text tones aligned with IssuesTable severity/status colors. */
export function pdfValidationResultTone(
  doc: Pick<PdfDocument, 'status' | 'issue_count' | 'ignored'>
): 'error' | 'success' | 'warning' | 'info' | 'muted' {
  if (doc.ignored) return 'muted'
  if (doc.status === 'failed') return 'error'
  if (doc.status === 'pending' || doc.status === 'processing') return 'warning'
  if ((doc.issue_count ?? 0) > 0) return 'error'
  return 'success'
}

export function pdfValidationResultColor(
  doc: Pick<PdfDocument, 'status' | 'issue_count' | 'ignored'>
): 'error' | 'success' | 'warning' | 'neutral' {
  const tone = pdfValidationResultTone(doc)
  if (tone === 'muted' || tone === 'info') return 'neutral'
  return tone
}

export function pdfValidationResultTextClass(
  doc: Pick<PdfDocument, 'status' | 'issue_count' | 'ignored'>
): string {
  const tone = pdfValidationResultTone(doc)
  if (tone === 'error') return 'text-error'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'success') return 'text-success'
  if (tone === 'info') return 'text-info'
  return 'text-muted'
}

export function pdfCheckPassed(value?: boolean, status?: PdfDocumentStatus): boolean | null {
  if (status !== 'complete') return null
  return value === true
}
