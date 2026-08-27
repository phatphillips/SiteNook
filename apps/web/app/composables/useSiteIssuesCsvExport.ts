import type { Ref } from 'vue'
import type { AccessibilityIssue } from '~/types/sitenook'
import type { TableExportModalConfig, TableExportOptions } from '~/utils/tableExportScope'
import {
  mainPageCount,
  resolveMainRows,
  resolveSubRows
} from '~/utils/tableExportScope'
import { fetchAllPages } from '~/utils/fetchAllPages'
import { exportFilename } from '~/utils/csvExport'
import { buildIssuesCsv } from '~/utils/export/issuesExport'
import type { AffectedPageSummary } from '~/utils/affectedPages'
import type { A11yIssuesApiResponse, A11yRuleStats } from '~/composables/useA11yIssuesPage'

const SUBTABLE_PAGE_SIZE = 10

export function useSiteIssuesCsvExport(options: {
  siteId: Ref<string>
  items: Ref<AccessibilityIssue[]>
  total: Ref<number>
  page: Ref<number>
  perPage: Ref<number>
  pointsToGainByRule: Ref<Map<string, number>>
  ruleStats: Ref<Map<string, A11yRuleStats>>
  buildQueryParams: () => Record<string, unknown>
  loadAffectedPagesForRule: (ruleId: string) => Promise<AffectedPageSummary[]>
  getColumnVisibility?: () => Record<string, boolean> | undefined
}) {
  const { pb, awaitAuthReady } = usePocketBase()
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

  async function fetchIssuesPage(pageNum: number) {
    await awaitAuthReady()
    const token = pb?.authStore.token
    const response = await $fetch<A11yIssuesApiResponse>(
      `/api/sites/${options.siteId.value}/accessibility/issues`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        query: { ...options.buildQueryParams(), page: pageNum }
      }
    )
    return { items: response.items, total: response.total, perPage: response.perPage }
  }

  async function runExport(exportOptions: TableExportOptions) {
    await executeExport(exportOptions, exportFilename('issues', options.siteId.value), async (opts, onProgress) => {
      onProgress('Fetching issues…')
      const allRows = await fetchAllPages(fetchIssuesPage, {
        onProgress: (current, totalPages) => onProgress(`Fetching page ${current} of ${totalPages}…`)
      })

      const mainRows = resolveMainRows(allRows, opts, options.page.value, options.perPage.value)
      const includeSubtable = opts.dataMode === 'mainWithSubtable'
      const affectedByIssue = new Map<string, AffectedPageSummary[]>()

      if (includeSubtable) {
        for (const [index, issue] of mainRows.entries()) {
          onProgress(`Loading affected pages ${index + 1}/${mainRows.length}…`)
          const pages = await options.loadAffectedPagesForRule(issue.rule_id)
          const key = `:${issue.rule_id}`
          affectedByIssue.set(key, resolveSubRows(pages, opts, 0, SUBTABLE_PAGE_SIZE))
        }
      }

      onProgress('Building CSV…')
      return buildIssuesCsv(mainRows, affectedByIssue, {
        includeSubtable,
        ctx: {
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
