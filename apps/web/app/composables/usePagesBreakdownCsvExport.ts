import type { Ref } from 'vue'
import type { AccessibilityIssue } from '~/types/sitenook'
import type { TableExportModalConfig, TableExportOptions } from '~/utils/tableExportScope'
import { mainPageCount, resolveMainRows, resolveSubRows } from '~/utils/tableExportScope'
import { exportFilename } from '~/utils/csvExport'
import {
  buildPagesBreakdownCsv,
  buildPagesBreakdownRows
} from '~/utils/export/pagesBreakdownExport'

const SUBTABLE_PAGE_SIZE = 20

export function usePagesBreakdownCsvExport(options: {
  issues: Ref<AccessibilityIssue[]>
  siteId: Ref<string>
  getColumnVisibility?: () => Record<string, boolean> | undefined
}) {
  const { executeExport, exporting, progressMessage } = useTableExport()
  const exportModalOpen = ref(false)

  const pageRows = computed(() => buildPagesBreakdownRows(options.issues.value))

  const exportConfig = computed((): TableExportModalConfig => {
    const rows = pageRows.value
    const subTotal = rows.reduce((sum, row) => sum + row.issues.length, 0)
    const pageSize = 20
    return {
      hasSubtable: true,
      subtableLabel: 'Issues on page',
      counts: {
        mainTotal: rows.length,
        mainPageCount: mainPageCount(rows.length, pageSize),
        mainCurrentPageRows: Math.min(pageSize, rows.length),
        subtablePageSize: SUBTABLE_PAGE_SIZE,
        subtableTotalRows: subTotal,
        subtableCurrentPageRows: Math.min(SUBTABLE_PAGE_SIZE, subTotal)
      }
    }
  })

  async function runExport(exportOptions: TableExportOptions) {
    await executeExport(
      exportOptions,
      exportFilename('issues-by-page', options.siteId.value),
      async (opts, onProgress) => {
        onProgress('Building CSV…')
        const allRows = pageRows.value
        const mainRows = resolveMainRows(allRows, opts, 1, 20)
        const issuesByPage = new Map<string, AccessibilityIssue[]>()

        if (opts.dataMode === 'mainWithSubtable') {
          for (const row of mainRows) {
            const key = row.url.toLowerCase()
            issuesByPage.set(
              key,
              resolveSubRows(row.issues, opts, 0, SUBTABLE_PAGE_SIZE)
            )
          }
        }

        return buildPagesBreakdownCsv(mainRows, issuesByPage, {
          includeSubtable: opts.dataMode === 'mainWithSubtable',
          columnVisibility: options.getColumnVisibility?.()
        })
      }
    )
  }

  return {
    exportModalOpen,
    exportConfig,
    exporting,
    progressMessage,
    runExport
  }
}
