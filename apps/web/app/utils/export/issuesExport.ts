import type { AccessibilityIssue } from '~/types/sitenook'
import type { OrgAccessibilityIssueRow } from '~/composables/useOrgAccessibilityIssues'
import type { AffectedPageSummary } from '~/utils/affectedPages'
import { pageDisplayTitle } from '~/utils/affectedPages'
import { buildCsv } from '~/utils/csvExport'
import { isColumnVisible } from '~/utils/tableExportScope'
import { formatPointsToGain } from '~/composables/useAccessibility'
import {
  issueTargetCategory,
  issueTargetCategoryLabel,
  issueWcagLevelDisplay,
  issueWcagScDisplay
} from '~/utils/issueLabels'

export interface IssueExportContext {
  showSiteColumn?: boolean
  pointsToGainByRule?: Map<string, number>
  ruleStats?: Map<string, { pages: number, occurrences: number }>
  columnVisibility?: Record<string, boolean>
}

function severityLabel(impact: AccessibilityIssue['impact']): string {
  if (impact === 'critical' || impact === 'serious') return 'Critical'
  if (impact === 'moderate') return 'Moderate'
  return 'Minor'
}

function pageCount(issue: AccessibilityIssue, ctx: IssueExportContext): number {
  const stats = ctx.ruleStats?.get(issue.rule_id)
  return stats?.pages ?? 0
}

function occurrenceCount(issue: AccessibilityIssue, ctx: IssueExportContext): number {
  const stats = ctx.ruleStats?.get(issue.rule_id)
  return stats?.occurrences ?? 0
}

function pointsLabel(issue: AccessibilityIssue, ctx: IssueExportContext): string {
  const points = ctx.pointsToGainByRule?.get(issue.rule_id)
  if (points == null) return ''
  return formatPointsToGain(points)
}

type IssueRow = AccessibilityIssue & { siteName?: string, siteId?: string }

export function buildIssuesCsv(
  issues: IssueRow[],
  affectedByIssue: Map<string, AffectedPageSummary[]>,
  options: {
    includeSubtable: boolean
    ctx: IssueExportContext
  }
): string {
  const { includeSubtable, ctx } = options
  const vis = ctx.columnVisibility

  const parentHeaders: string[] = []
  if (ctx.showSiteColumn && isColumnVisible(vis, 'site')) parentHeaders.push('Site')
  if (isColumnVisible(vis, 'issue')) parentHeaders.push('Issue', 'axe rule')
  if (isColumnVisible(vis, 'target_category')) parentHeaders.push('Type')
  if (isColumnVisible(vis, 'wcag_level')) parentHeaders.push('WCAG level')
  if (isColumnVisible(vis, 'wcag_sc')) parentHeaders.push('WCAG SC')
  if (isColumnVisible(vis, 'responsible_role')) parentHeaders.push('Responsibility')
  if (isColumnVisible(vis, 'element_type')) parentHeaders.push('Element type')
  if (isColumnVisible(vis, 'impact')) parentHeaders.push('Severity')
  if (isColumnVisible(vis, 'pages')) parentHeaders.push('Pages')
  if (isColumnVisible(vis, 'occurrences')) parentHeaders.push('Occurrences')
  if (isColumnVisible(vis, 'pointsToGain')) parentHeaders.push('Points to gain')

  const subHeaders = includeSubtable
    ? ['Page URL', 'Page title', 'Page occurrences']
    : []

  const headers = [...parentHeaders, ...subHeaders]
  const rows: string[][] = []

  for (const issue of issues) {
    const parentCells: string[] = []
    if (ctx.showSiteColumn && isColumnVisible(vis, 'site')) {
      parentCells.push(String((issue as OrgAccessibilityIssueRow).siteName ?? ''))
    }
    if (isColumnVisible(vis, 'issue')) {
      parentCells.push(issue.description, issue.rule_id)
    }
    if (isColumnVisible(vis, 'target_category')) {
      parentCells.push(issueTargetCategoryLabel(issueTargetCategory(issue)))
    }
    if (isColumnVisible(vis, 'wcag_level')) {
      parentCells.push(issueWcagLevelDisplay(issue) ?? '')
    }
    if (isColumnVisible(vis, 'wcag_sc')) {
      parentCells.push(issueWcagScDisplay(issue) ?? '')
    }
    if (isColumnVisible(vis, 'responsible_role')) parentCells.push(String(issue.responsible_role ?? ''))
    if (isColumnVisible(vis, 'element_type')) parentCells.push(String(issue.element_type ?? ''))
    if (isColumnVisible(vis, 'impact')) parentCells.push(severityLabel(issue.impact))
    if (isColumnVisible(vis, 'pages')) parentCells.push(String(pageCount(issue, ctx)))
    if (isColumnVisible(vis, 'occurrences')) parentCells.push(String(occurrenceCount(issue, ctx)))
    if (isColumnVisible(vis, 'pointsToGain')) parentCells.push(pointsLabel(issue, ctx))

    const key = `${(issue as OrgAccessibilityIssueRow).siteId ?? ''}:${issue.rule_id}`
    const pages = affectedByIssue.get(key) ?? []

    if (!includeSubtable || !pages.length) {
      rows.push([...parentCells, ...(includeSubtable ? ['', '', ''] : [])])
      continue
    }

    for (const page of pages) {
      rows.push([
        ...parentCells,
        page.url,
        pageDisplayTitle(page),
        String(page.occurrences)
      ])
    }
  }

  return buildCsv(headers, rows)
}
