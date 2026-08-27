import type { SeoIssue } from '~/types/sitenook'
import type { OrgSeoIssueRow } from '~/composables/useOrgSEO'
import type { SeoAffectedPageRow } from '~/utils/seoIssues'
import { uniqueSeoByRule } from '~/utils/seoIssues'
import { ruleLabel } from '~/utils/seoRules'
import { buildCsv } from '~/utils/csvExport'
import { pageDisplayTitle } from '~/utils/affectedPages'

type SeoRow = SeoIssue & { siteName?: string, siteId?: string }

export function buildSeoIssuesCsv(
  allIssues: SeoRow[],
  mainIssues: SeoRow[],
  affectedByRule: Map<string, SeoAffectedPageRow[]>,
  options: {
    includeSubtable: boolean
    showSiteColumn?: boolean
  }
): string {
  const grouped = uniqueSeoByRule(mainIssues)
  const parentHeaders = options.showSiteColumn
    ? ['Site', 'Issue', 'Rule ID', 'Severity', 'Pages']
    : ['Issue', 'Rule ID', 'Severity', 'Pages']

  const subHeaders = options.includeSubtable
    ? ['Page URL', 'Page title', 'Current value', 'Expected value']
    : []

  const headers = [...parentHeaders, ...subHeaders]
  const rows: string[][] = []

  for (const issue of grouped) {
    const parentCells: string[] = []
    if (options.showSiteColumn) {
      parentCells.push(String((issue as OrgSeoIssueRow).siteName ?? ''))
    }
    const title = issue.title || ruleLabel(issue.rule_id)
    const pages = affectedByRule.get(issue.rule_id) ?? []
    parentCells.push(
      title,
      issue.rule_id,
      issue.severity,
      String(pages.length)
    )

    if (!options.includeSubtable || !pages.length) {
      rows.push([...parentCells, ...(options.includeSubtable ? ['', '', '', ''] : [])])
      continue
    }

    for (const page of pages) {
      rows.push([
        ...parentCells,
        page.url,
        pageDisplayTitle(page),
        page.currentValue ?? '',
        page.expectedValue ?? ''
      ])
    }
  }

  void allIssues
  return buildCsv(headers, rows)
}
