import type { VeraPdfValidationResponse, VeraPdfValidationResult } from './veraPdfClient.js'

export interface MappedPdfIssue {
  category: 'document' | 'element'
  rule_id: string
  title: string
  description?: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  page_number?: number
  occurrence_count: number
  evidence?: Record<string, unknown>
}

export interface MappedPdfReport {
  compliant: boolean
  machineReadable: boolean
  hasPdfTags: boolean
  issueCount: number
  accessibilityScore: number
  documentTitle?: string
  issues: MappedPdfIssue[]
}

function parsePageFromContext(context?: string): number | undefined {
  if (!context) return undefined
  const match = context.match(/pages?\[(\d+)\]/i)
  if (match?.[1]) return Number.parseInt(match[1], 10) + 1
  const pageMatch = context.match(/page\s*(\d+)/i)
  if (pageMatch?.[1]) return Number.parseInt(pageMatch[1], 10)
  return undefined
}

export function toFriendlyPdfIssueTitle(description: string): string {
  const d = description.toLowerCase()

  if (d.includes('displaydoctitle') || d.includes('dc:title') || (d.includes('title') && d.includes('metadata'))) {
    return 'The document has no title'
  }
  if (
    d.includes('table')
    && (d.includes('header') || d.includes(' th ') || d.includes('scope') || d.includes('table headings'))
  ) {
    return 'The table has no table headings'
  }
  if (d.includes('heading') || d.includes(' h1 ') || d.includes('headings shall')) {
    return 'The document contains no headings'
  }
  if (
    d.includes('alternate description')
    || d.includes('alt entry')
    || d.includes('alt-text')
    || (d.includes('figure') && d.includes('alt'))
  ) {
    return 'The image has no alternative presentation'
  }
  if (d.includes('natural language')) {
    return 'Text language is not specified'
  }
  if (d.includes('structtreeroot') || d.includes('structure hierarchy')) {
    return 'The document is not tagged'
  }
  if (d.includes('marked') && d.includes('true')) {
    return 'The document is not marked as tagged'
  }
  if (d.includes('artifact') || d.includes('tagged as real content')) {
    return 'Content is not properly tagged'
  }

  const sentence = description.split(/[.!]/)?.[0]?.trim()
  if (sentence && sentence.length <= 120) return sentence
  return description.length > 120 ? `${description.slice(0, 117)}…` : description
}

function buildRuleId(result: VeraPdfValidationResult): string {
  if (result.clause && result.testNumber != null) {
    return `${result.clause}-${result.testNumber}`
  }
  const statement = result.statement ?? 'unknown'
  return statement.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)
}

function inferCategory(title: string, statement: string, tags?: string[]): 'document' | 'element' {
  const blob = `${title} ${statement}`.toLowerCase()
  if (
    blob.includes('document')
    || blob.includes('catalog')
    || blob.includes('metadata')
    || blob.includes('title')
    || blob.includes('language')
    || blob.includes('tagged')
    || blob.includes('structure hierarchy')
    || blob.includes('marked')
    || (tags?.includes('metadata') ?? false)
    || (tags?.includes('syntax') ?? false)
  ) {
    return 'document'
  }
  return 'element'
}

function inferSeverity(title: string, statement: string): MappedPdfIssue['severity'] {
  const blob = `${title} ${statement}`.toLowerCase()
  if (blob.includes('title') || blob.includes('alt') || blob.includes('heading') || blob.includes('structure')) {
    return 'serious'
  }
  if (blob.includes('table') || blob.includes('link') || blob.includes('language')) {
    return 'moderate'
  }
  return 'minor'
}

function failedRuleCount(result: VeraPdfValidationResult): number {
  if (typeof result.failedChecks === 'number' && result.failedChecks > 0) {
    return result.failedChecks
  }
  return (result.checks ?? []).filter(check => check.status === 'failed' || check.status === 'warning').length
}

function collectFailedChecks(report: VeraPdfValidationResponse): Array<{
  title: string
  description: string
  rule_id: string
  category: 'document' | 'element'
  severity: MappedPdfIssue['severity']
  page_number?: number
  occurrence_count: number
  evidence?: Record<string, unknown>
}> {
  const items: Array<{
    title: string
    description: string
    rule_id: string
    category: 'document' | 'element'
    severity: MappedPdfIssue['severity']
    page_number?: number
    occurrence_count: number
    evidence?: Record<string, unknown>
  }> = []

  for (const result of report.validationResult ?? []) {
    const count = failedRuleCount(result)
    if (count <= 0) continue

    const statement = result.statement ?? ''
    const firstFailed = (result.checks ?? []).find(check => check.status === 'failed' || check.status === 'warning')
    const title = toFriendlyPdfIssueTitle(statement || firstFailed?.errorMessage || 'Accessibility issue')

    items.push({
      title,
      description: statement || firstFailed?.errorMessage || title,
      rule_id: buildRuleId(result),
      category: inferCategory(title, statement, result.tags),
      severity: inferSeverity(title, statement),
      page_number: parsePageFromContext(firstFailed?.context ?? firstFailed?.location),
      occurrence_count: count,
      evidence: {
        context: firstFailed?.context ?? firstFailed?.location,
        clause: result.clause,
        testNumber: result.testNumber,
        tags: result.tags
      }
    })
  }

  return items
}

function groupIssues(
  failed: ReturnType<typeof collectFailedChecks>
): MappedPdfIssue[] {
  const grouped = new Map<string, MappedPdfIssue>()

  for (const item of failed) {
    const key = `${item.category}:${item.title}`
    const existing = grouped.get(key)
    if (existing) {
      existing.occurrence_count += item.occurrence_count
      if (!existing.page_number && item.page_number) {
        existing.page_number = item.page_number
      }
    } else {
      grouped.set(key, { ...item })
    }
  }

  return Array.from(grouped.values())
}

function hasFailedRuleMatching(report: VeraPdfValidationResponse, patterns: RegExp[]): boolean {
  return (report.validationResult ?? []).some((result) => {
    const statement = (result.statement ?? '').toLowerCase()
    return patterns.some(pattern => pattern.test(statement))
  })
}

function inferHasPdfTags(report: VeraPdfValidationResponse): boolean {
  return !hasFailedRuleMatching(report, [
    /structure hierarchy.*structtreeroot/i,
    /structtreeroot entry/i,
    /marked.*true/i,
    /marked dictionary/i
  ])
}

function inferMachineReadable(report: VeraPdfValidationResponse): boolean {
  if (!inferHasPdfTags(report)) return false
  return !hasFailedRuleMatching(report, [
    /tagged as real content/i,
    /marked as artifact/i,
    /not machine-readable/i
  ])
}

function scoreFromIssueCount(issueCount: number): number {
  if (issueCount <= 0) return 100
  const penalty = Math.min(issueCount * 3, 95)
  return Math.max(5, 100 - penalty)
}

export function mapVeraPdfReport(report: VeraPdfValidationResponse): MappedPdfReport {
  const failed = collectFailedChecks(report)
  const issues = groupIssues(failed)
  const issueCount = issues.reduce((sum, issue) => sum + issue.occurrence_count, 0)

  return {
    compliant: report.compliant === true && issueCount === 0,
    machineReadable: inferMachineReadable(report),
    hasPdfTags: inferHasPdfTags(report),
    issueCount,
    accessibilityScore: scoreFromIssueCount(issueCount),
    issues
  }
}
