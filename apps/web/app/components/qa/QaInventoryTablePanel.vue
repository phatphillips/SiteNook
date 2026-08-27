<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { getExpandedRowModel, getPaginationRowModel, getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/vue-table'
import type { InventoryPageRow } from '~/types/sitenook'
import type { OrgInventoryTab } from '~/composables/useOrgInventory'
import { INVENTORY_TABLE_SKELETON_COLUMNS } from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI } from '~/utils/dataTableUi'
import { formatInventoryFileSize, inventoryRowSizeBytes } from '~/utils/inventoryPages'
import { isInventoryImageUrl, isInventoryPdfUrl, normalizeInventoryUrl } from '~/utils/inventoryUrl'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'

type InventoryRow = InventoryPageRow & { siteId?: string, siteName?: string, size_bytes?: number | null }
type AssetRow = Record<string, unknown> & {
  siteId?: string
  siteName?: string
  found_on_page_count?: number | null
}
type TableRow = InventoryRow | AssetRow

const props = withDefaults(defineProps<{
  tab: OrgInventoryTab
  search?: string
  pages: InventoryRow[]
  /** Raw qa_inventory rows (site view); split by tab client-side when set. */
  inventory?: Record<string, unknown>[]
  /** Pre-filtered asset rows (org view). */
  assets?: AssetRow[]
  loading?: boolean
  refreshing?: boolean
  serverPaginated?: boolean
  total?: number
  page?: number
  pageSize?: number
  footerSummary?: string
  showSiteColumn?: boolean
}>(), {
  search: '',
  inventory: () => [],
  assets: () => [],
  loading: false,
  refreshing: false,
  serverPaginated: false,
  total: 0,
  page: 1,
  pageSize: 25,
  showSiteColumn: false
})

const emit = defineEmits<{
  'update:tab': [OrgInventoryTab]
  'update:search': [string]
  'update:page': [number]
}>()

const stableLoading = useStableLoading(toRef(() => props.loading))
const { resolvedSiteId } = useWorkspaceSiteFilter()
const UButton = resolveComponent('UButton')
const table = useTemplateRef<{ tableApi?: {
  getFilteredRowModel: () => { rows: unknown[] }
  getState: () => { pagination: { pageIndex: number } }
  setPageIndex: (i: number) => void
} }>('table')
const tablePanelRef = useTemplateRef<HTMLElement>('tablePanelRef')

const pagination = ref({ pageIndex: 0, pageSize: props.pageSize })
const sorting = ref<SortingState>([{ id: 'url', desc: false }])
const expanded = ref<Record<string, boolean>>({})

const isAssetTab = computed(() => props.tab !== 'pages')

const tabModel = computed({
  get: () => props.tab,
  set: value => emit('update:tab', value)
})

const searchModel = computed({
  get: () => props.search,
  set: value => emit('update:search', value)
})

const files = computed(() =>
  props.inventory.filter((i) => {
    const url = String(i.url ?? '')
    if (i.is_pdf || isInventoryPdfUrl(url)) return false
    if (isInventoryImageUrl(url) || String(i.mime_type || '').startsWith('image/')) return false
    return i.content_type === 'asset'
  })
)
const images = computed(() =>
  props.inventory.filter((i) => {
    const url = String(i.url ?? '')
    return isInventoryImageUrl(url) || String(i.mime_type || '').startsWith('image/')
  })
)
const pdfs = computed(() =>
  props.inventory.filter(i => i.is_pdf || isInventoryPdfUrl(String(i.url ?? '')))
)

const tabItems = computed(() => {
  if (props.serverPaginated) {
    return [
      { label: 'Pages', value: 'pages' },
      { label: 'Files', value: 'files' },
      { label: 'Images', value: 'images' },
      { label: 'PDFs', value: 'pdfs' }
    ]
  }
  return [
    { label: `Pages (${props.pages.length})`, value: 'pages' },
    { label: `Files (${files.value.length})`, value: 'files' },
    { label: `Images (${images.value.length})`, value: 'images' },
    { label: `PDFs (${pdfs.value.length})`, value: 'pdfs' }
  ]
})

const activeAssetRows = computed((): AssetRow[] => {
  if (props.serverPaginated) return props.assets
  if (props.tab === 'files') return files.value as AssetRow[]
  if (props.tab === 'images') return images.value as AssetRow[]
  if (props.tab === 'pdfs') return pdfs.value as AssetRow[]
  return []
})

const activeRows = computed(() =>
  props.tab === 'pages' ? props.pages : activeAssetRows.value
)

const showInitialSkeleton = computed(
  () => stableLoading.value && !activeRows.value.length
)

watch(
  () => props.pageSize,
  (size) => {
    pagination.value.pageSize = size
  }
)

function sortableHeader<T>(column: Column<T, unknown>, label: string, align: 'left' | 'right' | 'center' = 'left') {
  const isSorted = column.getIsSorted()
  const button = h(UButton, {
    color: 'neutral',
    variant: 'ghost',
    label,
    icon: isSorted
      ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow')
      : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
  })
  if (align === 'left') return button
  return h('div', {
    class: align === 'right' ? 'flex justify-end' : 'flex justify-center'
  }, [button])
}

function assetSiteId(row: AssetRow): string {
  return row.siteId ?? resolvedSiteId.value ?? ''
}

function inventoryRowId(row: AssetRow, index: number): string {
  return String(row.id ?? `${assetSiteId(row)}:${String(row.url ?? '')}:${index}`)
}

function sourcePageCount(row: AssetRow): number {
  const count = row.found_on_page_count
  return typeof count === 'number' && count > 0 ? count : 0
}

function urlCell(raw: string) {
  const url = raw ? normalizeInventoryUrl(raw) : ''
  if (!url) return '—'
  return h('a', {
    href: url,
    target: '_blank',
    rel: 'noopener noreferrer',
    class: 'text-sm text-primary hover:underline block truncate',
    title: url
  }, url)
}

const pageColumns = computed((): TableColumn<TableRow>[] => [
  {
    accessorKey: 'url',
    header: ({ column }) => sortableHeader(column, 'URL'),
    meta: { class: { th: 'min-w-0', td: 'min-w-0 max-w-0' } },
    cell: ({ row }) => urlCell(String(row.original.url ?? ''))
  },
  {
    id: 'size',
    accessorFn: row => inventoryRowSizeBytes(row as Record<string, unknown>),
    header: ({ column }) => sortableHeader(column, 'Size', 'right'),
    meta: {
      class: {
        th: 'w-[7rem] shrink-0 text-right tabular-nums whitespace-nowrap',
        td: 'w-[7rem] shrink-0 text-right tabular-nums whitespace-nowrap'
      }
    },
    cell: ({ row }) => formatInventoryFileSize(
      inventoryRowSizeBytes(row.original as Record<string, unknown>)
    )
  }
])

const assetColumns = computed((): TableColumn<TableRow>[] => {
  const cols: TableColumn<TableRow>[] = [
    {
      id: 'expand',
      enableSorting: false,
      enableHiding: false,
      meta: { class: { th: 'w-11 max-w-[2.75rem] p-0', td: 'w-11 max-w-[2.75rem] p-0 text-center' } },
      cell: ({ row }) => {
        const asset = row.original as AssetRow
        if (sourcePageCount(asset) === 0) return null
        return h(UButton, {
          color: 'neutral',
          variant: 'ghost',
          icon: 'i-lucide-chevron-down',
          square: true,
          size: 'xs',
          'aria-label': 'Expand source pages',
          ui: {
            leadingIcon: ['transition-transform', row.getIsExpanded() ? 'duration-200 rotate-180' : '']
          },
          onClick: () => row.toggleExpanded()
        })
      }
    }
  ]

  if (props.showSiteColumn) {
    cols.push({
      id: 'site',
      accessorFn: row => (row as AssetRow).siteName ?? '',
      header: ({ column }) => sortableHeader(column, 'Site'),
      meta: { class: { th: 'min-w-[8rem] whitespace-nowrap', td: 'min-w-[8rem] whitespace-nowrap' } },
      cell: ({ row }) => h('span', { class: 'text-sm truncate block' },
        (row.original as AssetRow).siteName ?? '—')
    })
  }

  cols.push(
    {
      accessorKey: 'url',
      header: ({ column }) => sortableHeader(column, 'URL'),
      meta: { class: { th: 'min-w-0', td: 'min-w-0 max-w-0' } },
      cell: ({ row }) => urlCell(String(row.original.url ?? ''))
    },
    {
      id: 'foundOn',
      accessorFn: row => sourcePageCount(row as AssetRow),
      header: ({ column }) => sortableHeader(column, 'Pages', 'right'),
      meta: {
        class: {
          th: 'w-[5.5rem] shrink-0 text-right tabular-nums whitespace-nowrap',
          td: 'w-[5.5rem] shrink-0 text-right tabular-nums whitespace-nowrap'
        }
      },
      cell: ({ row }) => {
        const count = sourcePageCount(row.original as AssetRow)
        return count > 0 ? String(count) : '—'
      }
    },
    {
      id: 'size',
      accessorFn: row => inventoryRowSizeBytes(row as Record<string, unknown>),
      header: ({ column }) => sortableHeader(column, 'Size', 'right'),
      meta: {
        class: {
          th: 'w-[7rem] shrink-0 text-right tabular-nums whitespace-nowrap',
          td: 'w-[7rem] shrink-0 text-right tabular-nums whitespace-nowrap'
        }
      },
      cell: ({ row }) => formatInventoryFileSize(
        inventoryRowSizeBytes(row.original as Record<string, unknown>)
      )
    }
  )

  return cols
})

const inventoryColumns = computed((): TableColumn<TableRow>[] =>
  isAssetTab.value ? assetColumns.value : pageColumns.value
)

watch(isAssetTab, () => {
  expanded.value = {}
})

watch(
  () => [props.tab, props.page, props.assets.length] as const,
  () => {
    expanded.value = {}
  }
)

const filteredRowCount = computed(() => {
  if (props.serverPaginated) return props.total
  return table.value?.tableApi?.getFilteredRowModel().rows.length ?? activeRows.value.length
})

const showPagination = computed(() => {
  const pageSize = props.serverPaginated ? props.pageSize : pagination.value.pageSize
  return filteredRowCount.value > pageSize
})

const tablePaginationOptions = computed(() =>
  props.serverPaginated ? undefined : { getPaginationRowModel: getPaginationRowModel() }
)

const pageStart = computed(() => {
  if (props.serverPaginated) {
    return props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1
  }
  const pageSize = pagination.value.pageSize
  const index = table.value?.tableApi?.getState().pagination.pageIndex ?? 0
  const count = filteredRowCount.value
  if (!count) return 0
  return index * pageSize + 1
})

const pageEnd = computed(() => {
  if (props.serverPaginated) {
    return Math.min(props.page * props.pageSize, props.total)
  }
  const pageSize = pagination.value.pageSize
  const index = table.value?.tableApi?.getState().pagination.pageIndex ?? 0
  return Math.min((index + 1) * pageSize, filteredRowCount.value)
})

const resolvedFooterSummary = computed(() => {
  if (props.footerSummary) return props.footerSummary
  if (stableLoading.value && !activeRows.value.length) return ''
  if (!filteredRowCount.value) return ''
  return `Showing ${pageStart.value}-${pageEnd.value} of ${filteredRowCount.value.toLocaleString()}`
})

const showTableFooter = computed(
  () => !!resolvedFooterSummary.value || showPagination.value
)

const emptyState = computed(() => {
  if (props.tab === 'pages') {
    return {
      icon: 'i-lucide-archive',
      label: 'No inventory pages',
      description: 'Run scans to populate content inventory.'
    }
  }
  if (props.tab === 'pdfs') {
    return {
      icon: 'i-lucide-file-text',
      label: 'No PDF assets',
      description: 'PDF inventory appears after scans discover downloadable files.'
    }
  }
  return {
    icon: 'i-lucide-files',
    label: 'No assets',
    description: 'File inventory appears after scans discover downloadable assets.'
  }
})

function onPaginationChange(nextPage: number) {
  scrollDataTableIntoView(tablePanelRef.value)
  if (props.serverPaginated) {
    emit('update:page', nextPage)
    return
  }
  table.value?.tableApi?.setPageIndex(nextPage - 1)
}

watch(
  () => props.page,
  (nextPage, previousPage) => {
    if (!props.serverPaginated || nextPage === previousPage) return
    scrollDataTableIntoView(tablePanelRef.value)
  }
)

watch(
  () => pagination.value.pageIndex,
  (nextIndex, previousIndex) => {
    if (props.serverPaginated || nextIndex === previousIndex) return
    scrollDataTableIntoView(tablePanelRef.value)
  }
)
</script>

<template>
  <div
    ref="tablePanelRef"
    class="inventory-table-panel space-y-4"
  >
    <div class="flex flex-wrap items-center gap-3">
      <UTabs
        v-model="tabModel"
        :items="tabItems"
        class="min-w-0"
      />
      <TableSearchInput
        v-model="searchModel"
        placeholder="Search URL…"
        aria-label="Search inventory"
        class="ms-auto"
      />
      <UBadge
        v-if="refreshing"
        color="neutral"
        variant="subtle"
        size="sm"
      >
        Updating…
      </UBadge>
    </div>

    <div class="table-surface inventory-table-surface">
      <DataTableSkeleton
        v-if="showInitialSkeleton"
        :rows="pageSize"
        :layout="INVENTORY_TABLE_SKELETON_COLUMNS"
      />

      <div
        v-else
        class="inventory-table-scroll"
      >
        <UTable
          ref="table"
          v-model:pagination="pagination"
          v-model:sorting="sorting"
          v-model:expanded="expanded"
          :data="activeRows"
          :columns="inventoryColumns"
          :loading="stableLoading && !!activeRows.length"
          :pagination-options="tablePaginationOptions"
          :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
          :expanded-options="isAssetTab ? {
            getExpandedRowModel: getExpandedRowModel(),
            getRowCanExpand: row => sourcePageCount(row.original as AssetRow) > 0,
            getRowId: (row, index) => inventoryRowId(row as AssetRow, index)
          } : undefined"
          :empty-state="emptyState"
          :ui="{
            ...DATA_TABLE_UI,
            root: 'relative min-w-full',
            base: 'w-max min-w-full table-auto border-collapse',
            tr: 'data-[expanded=true]:bg-elevated/50 border-b border-default last:border-b-0'
          }"
        >
          <template #loading>
            <DataTableSkeleton
              :rows="Math.min(pageSize, 8)"
              :layout="INVENTORY_TABLE_SKELETON_COLUMNS"
              :show-header="false"
            />
          </template>
          <template #expanded="{ row }">
            <div
              v-if="isAssetTab && sourcePageCount(row.original as AssetRow) > 0"
              class="inventory-expanded-panel px-4 py-4"
            >
              <QaInventorySourcePagesPanel
                :asset-url="String((row.original as AssetRow).url ?? '')"
                :site-id="assetSiteId(row.original as AssetRow)"
              />
            </div>
          </template>
        </UTable>
      </div>

      <div
        v-if="showTableFooter && !showInitialSkeleton"
        class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2"
      >
        <p
          v-if="resolvedFooterSummary"
          class="text-xs text-muted"
        >
          {{ resolvedFooterSummary }}
        </p>
        <div
          v-else
          class="flex-1"
        />
        <UPagination
          v-if="showPagination"
          :page="serverPaginated ? page : (table?.tableApi?.getState().pagination.pageIndex ?? 0) + 1"
          :items-per-page="serverPaginated ? pageSize : pagination.pageSize"
          :total="filteredRowCount"
          @update:page="onPaginationChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.inventory-table-surface {
  overflow-x: auto;
  overflow-y: visible;
}

.inventory-table-scroll {
  min-width: 0;
}

.inventory-table-panel :deep(.inventory-table-scroll table) {
  width: max-content;
  min-width: 100%;
}

.inventory-table-panel :deep(tr[data-expanded='true'] > td) {
  overflow: visible;
  height: auto;
  white-space: normal;
}

.inventory-table-panel :deep(.inventory-expanded-panel) {
  overflow: visible;
}
</style>
