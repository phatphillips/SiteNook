import type { Ref, ComputedRef } from 'vue'
import type { TableExportModalConfig, TableExportOptions } from '~/utils/tableExportScope'
import { mainPageCount, resolveMainRows } from '~/utils/tableExportScope'
import { exportFilename } from '~/utils/csvExport'

export function useSimpleTableCsvExport<T>(options: {
  total: Ref<number>
  page: Ref<number>
  pageSize: Ref<number>
  currentRows: Ref<T[]>
  feature: string | Ref<string> | ComputedRef<string>
  scopeLabel: Ref<string>
  fetchAllRows: (onProgress: (message: string) => void) => Promise<T[]>
  buildCsv: (rows: T[]) => string
}) {
  const { executeExport, exporting, progressMessage } = useTableExport()
  const exportModalOpen = ref(false)
  const featureName = computed(() => unref(options.feature))

  const exportConfig = computed((): TableExportModalConfig => ({
    hasSubtable: false,
    counts: {
      mainTotal: options.total.value,
      mainPageCount: mainPageCount(options.total.value, options.pageSize.value),
      mainCurrentPageRows: options.currentRows.value.length
    }
  }))

  async function runExport(exportOptions: TableExportOptions) {
    await executeExport(
      exportOptions,
      exportFilename(featureName.value, options.scopeLabel.value),
      async (opts, onProgress) => {
        const allRows = await options.fetchAllRows(onProgress)
        const rows = resolveMainRows(allRows, opts, options.page.value, options.pageSize.value)
        onProgress('Building CSV…')
        return options.buildCsv(rows)
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
