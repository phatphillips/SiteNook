import type { AccessibilityIssue } from '~/types/sitenook'
import { buildCsv } from '~/utils/csvExport'
import { isColumnVisible } from '~/utils/tableExportScope'
import { formatIssueSeverity } from '~/utils/issueExplanation'

export interface PageBreakdownRow {
  url: string
  a: number
  aa: number
  aaa: number
  issues: AccessibilityIssue[]
}

export function buildPagesBreakdownRows(issues: AccessibilityIssue[]): PageBreakdownRow[] {
  const map = new Map<string, PageBreakdownRow>()
  for (const issue of issues.filter(i => i.status !== 'dismissed')) {
    const rawUrl = issue.expand?.page?.url
    if (!rawUrl) continue
    const key = rawUrl.toLowerCase()
    const row = map.get(key) ?? { url: rawUrl, a: 0, aa: 0, aaa: 0, issues: [] }
    row.issues.push(issue)
    map.set(key, row)
  }
  for (const row of map.values()) {
    const byRule = new Map<string, AccessibilityIssue>()
    for (const issue of row.issues) {
      if (!byRule.has(issue.rule_id)) byRule.set(issue.rule_id, issue)
    }
    row.issues = [...byRule.values()]
    row.a = row.issues.filter(i => i.wcag_level === 'A').length
    row.aa = row.issues.filter(i => i.wcag_level === 'AA').length
    row.aaa = row.issues.filter(i => i.wcag_level === 'AAA').length
  }
  return [...map.values()]
}

function ruleLabel(ruleId: string): string {
  return ruleId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function buildPagesBreakdownCsv(
  pageRows: PageBreakdownRow[],
  issuesByPage: Map<string, AccessibilityIssue[]>,
  options: {
    includeSubtable: boolean
    columnVisibility?: Record<string, boolean>
  }
): string {
  const vis = options.columnVisibility
  const parentHeaders: string[] = []
  if (isColumnVisible(vis, 'url')) parentHeaders.push('Page URL')
  if (isColumnVisible(vis, 'a')) parentHeaders.push('A')
  if (isColumnVisible(vis, 'aa')) parentHeaders.push('AA')
  if (isColumnVisible(vis, 'aaa')) parentHeaders.push('AAA')
  if (isColumnVisible(vis, 'issues')) parentHeaders.push('Issues')

  const subHeaders = options.includeSubtable
    ? ['Issue', 'Rule ID', 'WCAG level', 'Severity']
    : []

  const headers = [...parentHeaders, ...subHeaders]
  const rows: string[][] = []

  for (const page of pageRows) {
    const parentCells: string[] = []
    if (isColumnVisible(vis, 'url')) parentCells.push(page.url)
    if (isColumnVisible(vis, 'a')) parentCells.push(String(page.a))
    if (isColumnVisible(vis, 'aa')) parentCells.push(String(page.aa))
    if (isColumnVisible(vis, 'aaa')) parentCells.push(String(page.aaa))
    if (isColumnVisible(vis, 'issues')) {
      parentCells.push(String(page.a + page.aa + page.aaa))
    }

    const issues = issuesByPage.get(page.url.toLowerCase()) ?? page.issues

    if (!options.includeSubtable || !issues.length) {
      rows.push([...parentCells, ...(options.includeSubtable ? ['', '', '', ''] : [])])
      continue
    }

    for (const issue of issues) {
      rows.push([
        ...parentCells,
        ruleLabel(issue.rule_id),
        issue.rule_id,
        issue.wcag_level,
        formatIssueSeverity(issue.impact)
      ])
    }
  }

  return buildCsv(headers, rows)
}
