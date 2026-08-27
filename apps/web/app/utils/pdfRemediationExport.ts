import type { PdfDocument, PdfIssue, PdfRemediation } from '~/types/sitenook'
import { buildCsv } from '~/utils/csvExport'
import { format } from 'date-fns'
import { getPdfIssueGuidance } from '~/utils/pdfIssueGuidance'

export function buildPdfIssuesCsv(issues: PdfIssue[], document?: PdfDocument | null): string {
  const headers = [
    'PDF title',
    'Filename',
    'Rule ID',
    'Title',
    'Severity',
    'Category',
    'Page',
    'Occurrences',
    'Description',
    'Guidance'
  ]
  const title = document?.document_title || ''
  const filename = document?.filename || ''
  const rows = issues.map((issue) => {
    const guidance = getPdfIssueGuidance(issue)
    return [
      title,
      filename,
      issue.rule_id,
      issue.title,
      issue.severity,
      issue.category,
      issue.page_number != null ? String(issue.page_number) : '',
      String(issue.occurrence_count ?? 1),
      issue.description || '',
      [guidance.summary, ...guidance.fixSteps].join(' | ')
    ]
  })
  return buildCsv(headers, rows.map(row => row.map(String)))
}

export function buildPdfStructureOutlineCsv(document: PdfDocument): string {
  const items = document.structure_outline?.items ?? []
  const headers = ['ID', 'Type', 'Page', 'Level', 'Content', 'BBox']
  const rows = items.map(item => [
    String(item.id),
    item.type,
    item.page != null ? String(item.page) : '',
    item.level != null ? String(item.level) : '',
    item.content || '',
    item.bbox?.join(' ') || ''
  ])
  return buildCsv(headers, rows)
}

export function remediationLiftLabel(remediation: PdfRemediation | null | undefined): string {
  if (!remediation || remediation.status !== 'complete') return ''
  const before = remediation.before_issue_count ?? 0
  const after = remediation.after_issue_count ?? 0
  const delta = remediation.issue_delta ?? before - after
  const lift = typeof remediation.summary?.liftPercent === 'number'
    ? remediation.summary.liftPercent
    : before > 0
      ? Math.round((delta / before) * 1000) / 10
      : null
  if (lift == null) return `${delta} issues changed`
  return `${lift}% issue reduction (${before} → ${after})`
}

export function remediationStatusLabel(status?: string | null): string {
  switch (status) {
    case 'pending':
      return 'Assisted fix queued'
    case 'processing':
      return 'Generating assisted fix…'
    case 'complete':
      return 'Assisted fix ready'
    case 'failed':
      return 'Assisted fix failed'
    default:
      return 'No assisted fix yet'
  }
}

export function structureStatusLabel(status?: string | null): string {
  switch (status) {
    case 'pending':
      return 'Structure queued'
    case 'processing':
      return 'Extracting structure…'
    case 'complete':
      return 'Structure ready'
    case 'failed':
      return 'Structure failed'
    default:
      return 'No structure yet'
  }
}

export function formatPdfValidatedAt(value?: string | null): string {
  if (!value) return ''
  try {
    return format(new Date(value), 'yyyy-MM-dd HH:mm')
  } catch {
    return value
  }
}
