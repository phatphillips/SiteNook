import type { Ref } from 'vue'
import type { TableExportModalConfig, TableExportOptions } from '~/utils/tableExportScope'
import {
  mainPageCount,
  mapWithConcurrency,
  resolveMainRows,
  resolveSubRows
} from '~/utils/tableExportScope'
import { fetchAllPages } from '~/utils/fetchAllPages'
import { exportFilename } from '~/utils/csvExport'
import { buildIssuesCsv } from '~/utils/export/issuesExport'
import type { OrgAccessibilityIssueRow } from '~/composables/useOrgAccessibilityIssues'
import type { AffectedPageSummary } from '~/utils/affectedPages'
import type { A11yRuleStats } from '~/composables/useA11yIssuesPage'
import { orgApiFetch } from '~/utils/orgApiFetch'
import type { A11yIssuesApiResponse } from '~/composables/useA11yIssuesPage'

const SUBTABLE_PAGE_SIZE = 10

export function useIssuesCsvExport(options: {
  items: Ref<OrgAccessibilityIssueRow[]>
  total: Ref<number>
  page: Ref<number>
  perPage: Ref<number>
  pointsToGainByRule: Ref<Map<string, number>>
  ruleStats: Ref<Map<string, A11yRuleStats>>
  showSiteColumn: Ref<boolean>
  buildQueryParams: () => Record<string, unknown>
  loadAffectedPagesForRule: (ruleId: string, siteId?: string) => Promise<AffectedPageSummary[]>
  getAffectedPagesForRule: (ruleId: string, siteId?: string) => AffectedPageSummary[]
  scopeLabel: Ref<string>
  getColumnVisibility?: () => Record<string, boolean> | undefined
}) {
  const { executeExport, exporting, progressMessage } = useTableExport()
  const exportModalOpen = ref(false)

  const exportConfig = computed((): TableExportModalConfig => {
    const parents = options.items.value
    const subTotal = parents.reduce(
      (sum, issue) => sum + (options.ruleStats.value.get(issue.rule_id)?.pages ?? 0),
      0
    )
    const subCurrent = parents.reduce((sum, issue) => {
      const count = options.ruleStats.value.get(issue.rule_id)?.pages ?? 0
      return sum + Math.min(SUBTABLE_PAGE_SIZE, count)
    }, 0)

    return {
      hasSubtable: true,
      subtableLabel: 'Affected pages',
      counts: {
        mainTotal: options.total.value,
        mainPageCount: mainPageCount(options.total.value, options.perPage.value),
        mainCurrentPageRows: parents.length,
        subtablePageSize: SUBTABLE_PAGE_SIZE,
        subtableTotalRows: subTotal,
        subtableCurrentPageRows: subCurrent
      }
    }
  })

  async function runExport(exportOptions: TableExportOptions) {
    await executeExport(exportOptions, exportFilename('issues', options.scopeLabel.value), async (opts, onProgress) => {
      onProgress('Fetching issues…')
      const allRows = await fetchAllPages(
        async (pageNum) => {
          const response = await orgApiFetch<A11yIssuesApiResponse & { items: OrgAccessibilityIssueRow[] }>(
            '/api/org/accessibility/issues',
            { ...options.buildQueryParams(), page: pageNum }
          )
          return { items: response.items, total: response.total, perPage: response.perPage }
        },
        {
          onProgress: (current, totalPages) => onProgress(`Fetching page ${current} of ${totalPages}…`)
        }
      )

      const mainRows = resolveMainRows(allRows, opts, options.page.value, options.perPage.value)
      const includeSubtable = opts.dataMode === 'mainWithSubtable'
      const affectedByIssue = new Map<string, AffectedPageSummary[]>()

      if (includeSubtable && mainRows.length) {
        await mapWithConcurrency(
          mainRows,
          5,
          async (issue) => {
            const siteId = issue.siteId
            const pages = await options.loadAffectedPagesForRule(issue.rule_id, siteId)
            const key = `${siteId ?? ''}:${issue.rule_id}`
            const scoped = resolveSubRows(pages, opts, 0, SUBTABLE_PAGE_SIZE)
            affectedByIssue.set(key, scoped)
          },
          (done, total) => onProgress(`Loading affected pages ${done}/${total}…`)
        )
      }

      onProgress('Building CSV…')
      return buildIssuesCsv(mainRows, affectedByIssue, {
        includeSubtable,
        ctx: {
          showSiteColumn: options.showSiteColumn.value,
          pointsToGainByRule: options.pointsToGainByRule.value,
          ruleStats: options.ruleStats.value,
          columnVisibility: options.getColumnVisibility?.()
        }
      })
    })
  }

  return {
    exportModalOpen,
    exportConfig,
    exporting,
    progressMessage,
    runExport
  }
}
