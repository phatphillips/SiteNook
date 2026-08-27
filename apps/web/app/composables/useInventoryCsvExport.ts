import type { Ref } from 'vue'
import type { OrgInventoryTab } from '~/composables/useOrgInventory'
import type { OrgInventoryAssetRow, OrgInventoryPageRow } from '~/composables/useOrgInventory'
import type { TableExportModalConfig, TableExportOptions } from '~/utils/tableExportScope'
import {
  mainPageCount,
  mapWithConcurrency,
  resolveMainRows,
  resolveSubRows
} from '~/utils/tableExportScope'
import { fetchAllPages } from '~/utils/fetchAllPages'
import { exportFilename } from '~/utils/csvExport'
import { buildInventoryAssetsCsv, buildInventoryPagesCsv } from '~/utils/export/inventoryExport'
import { orgApiFetch } from '~/utils/orgApiFetch'
import type { InventorySourcePageSummary } from '~/types/sitenook'
import { normalizeInventoryUrl } from '~/utils/inventoryUrl'

const SUBTABLE_PAGE_SIZE = 25

export function useInventoryCsvExport(options: {
  tab: Ref<OrgInventoryTab>
  search: Ref<string>
  page: Ref<number>
  perPage: Ref<number>
  total: Ref<number>
  pages: Ref<OrgInventoryPageRow[]>
  assets: Ref<OrgInventoryAssetRow[]>
  resolvedSiteId: Ref<string | undefined>
  showSiteColumn: Ref<boolean>
  loadSourcePages: (url: string, siteId?: string) => Promise<InventorySourcePageSummary[]>
}) {
  const { executeExport, exporting, progressMessage } = useTableExport()
  const exportModalOpen = ref(false)

  const hasSubtable = computed(() => options.tab.value !== 'pages')

  const exportConfig = computed((): TableExportModalConfig => {
    const isPagesTab = options.tab.value === 'pages'
    const currentRows = isPagesTab ? options.pages.value.length : options.assets.value.length
    const subTotal = options.assets.value.reduce(
      (sum, asset) => sum + Number(asset.found_on_page_count ?? 0),
      0
    )

    return {
      hasSubtable: hasSubtable.value,
      subtableLabel: 'Source pages',
      counts: {
        mainTotal: options.total.value,
        mainPageCount: mainPageCount(options.total.value, options.perPage.value),
        mainCurrentPageRows: currentRows,
        subtablePageSize: SUBTABLE_PAGE_SIZE,
        subtableTotalRows: subTotal,
        subtableCurrentPageRows: Math.min(SUBTABLE_PAGE_SIZE, subTotal)
      }
    }
  })

  async function fetchInventoryPage(pageNum: number) {
    const result = await orgApiFetch<{
      items: (OrgInventoryPageRow | OrgInventoryAssetRow)[]
      total: number
      perPage: number
    }>('/api/org/qa/inventory', {
      page: pageNum,
      perPage: options.perPage.value,
      siteId: options.resolvedSiteId.value,
      search: options.search.value.trim() || undefined,
      tab: options.tab.value
    })
    return { items: result.items, total: result.total, perPage: result.perPage }
  }

  async function runExport(exportOptions: TableExportOptions) {
    const tab = options.tab.value
    const scope = options.resolvedSiteId.value ?? 'org'
    await executeExport(
      exportOptions,
      exportFilename(`inventory-${tab}`, scope),
      async (opts, onProgress) => {
        onProgress('Fetching inventory…')
        const allItems = await fetchAllPages(fetchInventoryPage, {
          onProgress: (current, totalPages) => onProgress(`Fetching page ${current} of ${totalPages}…`)
        })

        const mainRows = resolveMainRows(
          allItems,
          opts,
          options.page.value,
          options.perPage.value
        )

        if (tab === 'pages') {
          onProgress('Building CSV…')
          return buildInventoryPagesCsv(mainRows as OrgInventoryPageRow[], {
            showSiteColumn: options.showSiteColumn.value
          })
        }

        const includeSubtable = opts.dataMode === 'mainWithSubtable'
        const sourceByAsset = new Map<string, InventorySourcePageSummary[]>()

        if (includeSubtable) {
          await mapWithConcurrency(
            mainRows as OrgInventoryAssetRow[],
            5,
            async (asset) => {
              const url = String(asset.url ?? '')
              const siteId = String(asset.siteId ?? options.resolvedSiteId.value ?? '')
              const pages = await options.loadSourcePages(url, siteId)
              const key = `${siteId}:${normalizeInventoryUrl(url).toLowerCase()}`
              sourceByAsset.set(key, resolveSubRows(pages, opts, 0, SUBTABLE_PAGE_SIZE))
            },
            (done, total) => onProgress(`Loading source pages ${done}/${total}…`)
          )
        }

        onProgress('Building CSV…')
        return buildInventoryAssetsCsv(
          mainRows as OrgInventoryAssetRow[],
          tab,
          sourceByAsset,
          {
            includeSubtable,
            showSiteColumn: options.showSiteColumn.value
          }
        )
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
