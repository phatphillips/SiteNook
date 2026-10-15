<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { upperFirst } from 'scule'
import { format } from 'date-fns'
import { getPaginationRowModel, getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/vue-table'
import type { PdfDocument } from '~/types/sitenook'
import {
  VALIDATED_PDFS_VALIDATE_SKELETON_COLUMNS,
  VALIDATED_PDFS_VALIDATE_WITH_SITE_SKELETON_COLUMNS
} from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI, dataTableSortableHeader } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'

const props = withDefaults(defineProps<{
  documents: PdfDocument[]
  siteId?: string
  /** @deprecated Prefer unified library columns; kept for empty-copy variants. */
  mode?: 'validate' | 'audit' | 'library'
  siteNames?: Record<string, string>
  showSiteColumn?: boolean
  showSourceColumn?: boolean
  showSelect?: boolean
  enableActions?: boolean
  footerSummary?: string
  loading?: boolean
  pageSize?: number
  hideToolbar?: boolean
}>(), {
  mode: 'library',
  siteNames: () => ({}),
  showSiteColumn: false,
  showSourceColumn: true,
  showSelect: false,
  enableActions: true,
  footerSummary: undefined,
  loading: false,
  pageSize: 20,
  hideToolbar: false
})

const emit = defineEmits<{
  delete: [id: string]
  validate: [id: string]
  open: [doc: PdfDocument]
  export: []
  selectionChange: [ids: string[]]
}>()

const globalFilter = defineModel<string>('search', { default: '' })
const stableLoading = useStableLoading(toRef(() => props.loading))

const UButton = resolveComponent('UButton')
const UCheckbox = resolveComponent('UCheckbox')

const table = useTemplateRef<{ tableApi?: {
  getAllColumns: () => Array<{ id: string, getCanHide: () => boolean, getIsVisible: () => boolean }>
  getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } | undefined
  getFilteredRowModel: () => { rows: unknown[] }
  getSelectedRowModel: () => { rows: Array<{ original: PdfDocument }> }
  getState: () => { pagination: { pageIndex: number }, rowSelection: Record<string, boolean> }
  setPageIndex: (i: number) => void
  resetRowSelection: () => void
} }>('table')
const tablePanelRef = useTemplateRef<HTMLElement>('tablePanelRef')
const scrollRef = useTemplateRef<HTMLElement>('scrollRef')

const pagination = ref({ pageIndex: 0, pageSize: props.pageSize })
const sorting = ref<SortingState>([{ id: 'uploaded_on', desc: true }])
const rowSelection = ref<Record<string, boolean>>({})
const columnVisibility = ref<Record<string, boolean>>({})

watch(
  rowSelection,
  (selection) => {
    emit('selectionChange', Object.keys(selection).filter(id => selection[id]))
  },
  { deep: true }
)

watch(
  () => props.pageSize,
  (size) => {
    pagination.value.pageSize = size
  }
)

const columnLabels: Record<string, string> = {
  select: 'Select',
  title: 'PDF title',
  source: 'Source',
  site: 'Site',
  uploaded_on: 'Date',
  accessibility_score: 'Score',
  machine_readable: 'Machine-readable',
  has_pdf_tags: 'PDF tags',
  issue_count: 'Issues',
  status: 'Status',
  rescan: 'Rescan',
  actions: 'Actions'
}

function sortableHeader(
  column: Column<PdfDocument, unknown>,
  label: string,
  align: 'left' | 'right' | 'center' = 'left'
) {
  return dataTableSortableHeader(column, label, align)
}

function formatUploadedOn(doc: PdfDocument): string {
  const ts = doc.validated_at || doc.created
  if (!ts) return '—'
  try {
    return format(new Date(ts), 'dd/MM/yyyy, hh:mm a')
  } catch {
    return ts
  }
}

const STATUS_SORT: Record<PdfDocument['status'], number> = {
  processing: 4,
  pending: 3,
  complete: 2,
  failed: 1
}

const STICKY_COL_1 = 'validated-pdfs-sticky-col validated-pdfs-sticky-col--1'
const STICKY_COL_2 = 'validated-pdfs-sticky-col validated-pdfs-sticky-col--2'
const STICKY_COL_LEAD = 'validated-pdfs-sticky-col--lead'
const SELECT_COL = 'validated-pdfs-select-col p-0'
const TITLE_COL = 'validated-pdfs-title-col overflow-hidden'
const SITE_COL = 'validated-pdfs-site-col min-w-[7rem] max-w-[10rem] whitespace-nowrap truncate'
const CENTER_COL = 'validated-pdfs-center-col text-center'

function scoreToneClass(score: number): string {
  if (score >= 80) return 'text-success'
  if (score >= 60) return 'text-warning'
  return 'text-error'
}

const PDFS_TABLE_UI = {
  ...DATA_TABLE_UI,
  root: 'relative min-w-full',
  base: 'w-max min-w-full table-auto border-collapse',
  thead: 'border-b border-default',
  tbody: '',
  tr: ''
}

const columns = computed<TableColumn<PdfDocument>[]>(() => {
  const cols: TableColumn<PdfDocument>[] = []

  if (props.showSelect) {
    cols.push({
      id: 'select',
      enableHiding: false,
      enableSorting: false,
      header: ({ table: tableApi }) => h(UCheckbox, {
        modelValue: tableApi.getIsAllPageRowsSelected()
          ? true
          : tableApi.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : false,
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => {
          tableApi.toggleAllPageRowsSelected(value === true)
        },
        'aria-label': 'Select all'
      }),
      meta: {
        class: {
          th: `${SELECT_COL} ${STICKY_COL_1}`,
          td: `${SELECT_COL} ${STICKY_COL_1} text-center`
        }
      },
      cell: ({ row }) => h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(value === true),
        'aria-label': 'Select row'
      })
    })
  }

  cols.push({
    id: 'title',
    accessorFn: row => `${row.document_title || ''} ${row.filename || ''} ${row.url || ''}`,
    enableHiding: false,
    header: ({ column }) => sortableHeader(column, 'PDF title'),
    meta: {
      class: {
        th: props.showSelect
          ? `${TITLE_COL} ${STICKY_COL_2}`
          : `${TITLE_COL} ${STICKY_COL_2} ${STICKY_COL_LEAD}`,
        td: props.showSelect
          ? `${TITLE_COL} ${STICKY_COL_2}`
          : `${TITLE_COL} ${STICKY_COL_2} ${STICKY_COL_LEAD}`
      }
    },
    cell: ({ row }) => {
      const title = row.original.document_title || row.original.filename || 'Untitled PDF'
      const subtitle = row.original.source === 'crawl'
        ? (row.original.url || row.original.filename || '')
        : (row.original.filename || '')
      return h('div', { class: 'min-w-0 w-full space-y-0.5' }, [
        h('div', { class: 'flex items-center gap-2 min-w-0' }, [
          h('button', {
            type: 'button',
            title,
            class: 'text-sm font-medium text-default hover:text-highlighted truncate text-left min-w-0',
            onClick: (event: MouseEvent) => {
              event.preventDefault()
              event.stopPropagation()
              emit('open', row.original)
            }
          }, title),
          row.original.ignored
            ? h('span', { class: 'text-xs text-muted shrink-0' }, 'Ignored')
            : null
        ]),
        row.original.source === 'crawl' && row.original.url
          ? h('a', {
            href: row.original.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: row.original.url,
            class: 'text-xs text-muted hover:text-primary hover:underline block truncate w-full'
          }, subtitle)
          : h('span', { class: 'text-xs text-muted block truncate w-full' }, subtitle || '—')
      ])
    }
  })

  if (props.showSourceColumn) {
    cols.push({
      id: 'source',
      accessorFn: row => row.source,
      header: ({ column }) => sortableHeader(column, 'Source', 'center'),
      meta: {
        class: {
          th: `${CENTER_COL} min-w-[5.5rem] whitespace-nowrap`,
          td: `${CENTER_COL} whitespace-nowrap`
        }
      },
      cell: ({ row }) => h('div', { class: 'flex justify-center' }, [
        h('span', { class: 'text-sm text-muted' }, row.original.source === 'crawl' ? 'Crawl' : 'Upload')
      ])
    })
  }

  if (props.showSiteColumn) {
    cols.push({
      id: 'site',
      accessorFn: row => props.siteNames[row.site] || row.site,
      header: ({ column }) => sortableHeader(column, 'Site'),
      meta: { class: { th: SITE_COL, td: SITE_COL } },
      cell: ({ row }) => h('span', {
        class: 'text-sm text-muted truncate block',
        title: row.original.site
          ? (props.siteNames[row.original.site] || row.original.site)
          : 'Organization library'
      }, row.original.site
        ? (props.siteNames[row.original.site] || '—')
        : 'Organization')
    })
  }

  cols.push(
    {
      id: 'uploaded_on',
      accessorFn: row => row.validated_at || row.created || '',
      header: ({ column }) => sortableHeader(column, 'Date', 'center'),
      meta: {
        class: {
          th: `${CENTER_COL} min-w-[8.5rem] tabular-nums whitespace-nowrap`,
          td: `${CENTER_COL} tabular-nums whitespace-nowrap`
        }
      },
      cell: ({ row }) => h('div', { class: 'flex justify-center' }, [
        h('span', { class: 'text-sm text-muted' }, formatUploadedOn(row.original))
      ])
    },
    {
      id: 'accessibility_score',
      accessorFn: row => row.accessibility_score ?? -1,
      header: ({ column }) => sortableHeader(column, 'Score', 'center'),
      meta: {
        class: {
          th: `${CENTER_COL} min-w-[5.5rem] whitespace-nowrap`,
          td: `${CENTER_COL} whitespace-nowrap`
        }
      },
      cell: ({ row }) => {
        const score = row.original.accessibility_score
        if (score == null || row.original.status !== 'complete') {
          return h('div', { class: 'flex justify-center' }, [
            h('span', { class: 'text-sm text-muted' }, '—')
          ])
        }
        const rounded = Math.round(score)
        return h('div', { class: 'flex justify-center' }, [
          h('span', {
            class: `text-sm tabular-nums font-semibold ${scoreToneClass(rounded)}`
          }, `${rounded}/100`)
        ])
      }
    },
    {
      id: 'machine_readable',
      accessorFn: row => (row.machine_readable ? 1 : 0),
      header: ({ column }) => sortableHeader(column, 'Machine-readable', 'center'),
      meta: {
        class: {
          th: `${CENTER_COL} min-w-[7.5rem] whitespace-nowrap`,
          td: `${CENTER_COL} whitespace-nowrap`
        }
      },
      cell: ({ row }) => h('div', { class: 'flex justify-center' }, [
        h(resolveComponent('AccessibilityPdfCheckIcon'), {
          value: row.original.machine_readable,
          status: row.original.status
        })
      ])
    },
    {
      id: 'has_pdf_tags',
      accessorFn: row => (row.has_pdf_tags ? 1 : 0),
      header: ({ column }) => sortableHeader(column, 'PDF tags', 'center'),
      meta: {
        class: {
          th: `${CENTER_COL} min-w-[5.5rem] whitespace-nowrap`,
          td: `${CENTER_COL} whitespace-nowrap`
        }
      },
      cell: ({ row }) => h('div', { class: 'flex justify-center' }, [
        h(resolveComponent('AccessibilityPdfCheckIcon'), {
          value: row.original.has_pdf_tags,
          status: row.original.status
        })
      ])
    },
    {
      id: 'issue_count',
      accessorKey: 'issue_count',
      header: ({ column }) => sortableHeader(column, 'Issues', 'center'),
      meta: {
        class: {
          th: `${CENTER_COL} min-w-[4.5rem] tabular-nums whitespace-nowrap`,
          td: `${CENTER_COL} tabular-nums whitespace-nowrap`
        }
      },
      cell: ({ row }) => {
        const count = row.original.issue_count
        const complete = row.original.status === 'complete'
        if (!complete && count == null) {
          return h('div', { class: 'flex justify-center' }, [
            h('span', { class: 'text-sm text-muted' }, '—')
          ])
        }
        const n = count ?? 0
        return h('div', { class: 'flex justify-center' }, [
          h('span', {
            class: `text-sm tabular-nums ${n > 0 ? 'text-error' : 'text-muted'}`
          }, String(n))
        ])
      }
    },
    {
      id: 'status',
      accessorFn: row => {
        if (row.ignored) return 5
        return STATUS_SORT[row.status] ?? 0
      },
      header: ({ column }) => sortableHeader(column, 'Status', 'center'),
      meta: {
        class: {
          th: `${CENTER_COL} min-w-[6.5rem] whitespace-nowrap`,
          td: `${CENTER_COL} whitespace-nowrap`
        }
      },
      cell: ({ row }) => h('div', { class: 'flex justify-center' }, [
        h(resolveComponent('AccessibilityPdfStatusBadge'), {
          status: row.original.status,
          issueCount: row.original.issue_count,
          ignored: row.original.ignored
        })
      ])
    }
  )

  if (props.enableActions) {
    cols.push({
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      header: '',
      meta: {
        class: {
          th: 'min-w-[8.5rem] text-right whitespace-nowrap',
          td: 'text-right whitespace-nowrap'
        }
      },
      cell: ({ row }) => {
        const doc = row.original
        const busy = doc.status === 'processing' || doc.status === 'pending'
        const buttons = [
          h(UButton, {
            color: 'neutral',
            variant: 'ghost',
            icon: 'i-lucide-eye',
            square: true,
            size: 'xs',
            'aria-label': 'Open PDF Inspector',
            title: 'Open PDF Inspector',
            onClick: (event: MouseEvent) => {
              event.preventDefault()
              event.stopPropagation()
              emit('open', doc)
            }
          }),
          h(UButton, {
            color: 'neutral',
            variant: 'ghost',
            icon: 'i-lucide-refresh-cw',
            square: true,
            size: 'xs',
            disabled: busy,
            'aria-label': 'Rescan PDF',
            title: 'Rescan PDF',
            onClick: (event: MouseEvent) => {
              event.preventDefault()
              event.stopPropagation()
              emit('validate', doc.id)
            }
          })
        ]

        buttons.push(h(UButton, {
          color: 'error',
          variant: 'ghost',
          icon: 'i-lucide-trash-2',
          square: true,
          size: 'xs',
          'aria-label': 'Remove PDF',
          title: 'Remove PDF',
          onClick: (event: MouseEvent) => {
            event.preventDefault()
            event.stopPropagation()
            emit('delete', doc.id)
          }
        }))

        return h('div', { class: 'inline-flex items-center justify-end gap-0.5' }, buttons)
      }
    })
  }

  return cols
})

type ColumnMenuItem = {
  label: string
  type: 'checkbox'
  checked: boolean
  onUpdateChecked: (checked: boolean) => void
  onSelect: (e: Event) => void
}

const columnMenuItems = computed((): ColumnMenuItem[] => {
  const api = table.value?.tableApi
  if (!api) return []
  return api.getAllColumns()
    .filter(column => column.getCanHide())
    .map(column => ({
      label: columnLabels[column.id] ?? upperFirst(column.id),
      type: 'checkbox' as const,
      checked: column.getIsVisible(),
      onUpdateChecked(checked: boolean) {
        api.getColumn(column.id)?.toggleVisibility(!!checked)
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    }))
})

defineExpose({
  get columnMenuItems() {
    return columnMenuItems.value
  },
  getSelectedIds() {
    const api = table.value?.tableApi
    if (!api?.getSelectedRowModel) {
      return Object.keys(rowSelection.value).filter(id => rowSelection.value[id])
    }
    return api.getSelectedRowModel().rows.map((row: { original: PdfDocument }) => row.original.id)
  },
  clearSelection() {
    rowSelection.value = {}
    table.value?.tableApi?.resetRowSelection?.()
  },
  getExportState() {
    const rows = (table.value?.tableApi?.getFilteredRowModel().rows.map(
      (row: { original: PdfDocument }) => row.original
    ) ?? [...props.documents]) as PdfDocument[]
    const pageIndex = table.value?.tableApi?.getState().pagination.pageIndex ?? 0
    return {
      rows,
      total: rows.length,
      pageIndex,
      pageSize: pagination.value.pageSize
    }
  }
})

const skeletonLayout = computed(() => {
  if (props.showSiteColumn) {
    return VALIDATED_PDFS_VALIDATE_WITH_SITE_SKELETON_COLUMNS
  }
  return VALIDATED_PDFS_VALIDATE_SKELETON_COLUMNS
})

const filteredRowCount = computed(
  () => table.value?.tableApi?.getFilteredRowModel().rows.length ?? props.documents.length
)

const showPagination = computed(() => filteredRowCount.value > pagination.value.pageSize)

const showInitialSkeleton = computed(
  () => stableLoading.value && !props.documents.length
)

const showTableFooter = computed(
  () => !!props.footerSummary || showPagination.value
)

const hasRightOverflowShadow = ref(false)
const headerRowHeightPx = ref(0)
let scrollResizeObserver: ResizeObserver | undefined

function updateScrollChrome() {
  const el = scrollRef.value
  if (!el) {
    hasRightOverflowShadow.value = false
    headerRowHeightPx.value = 0
    return
  }
  const tableEl = el.querySelector('table')
  const scrollWidth = Math.max(el.scrollWidth, tableEl?.scrollWidth ?? 0)
  const clientWidth = el.clientWidth
  const remaining = scrollWidth - clientWidth - el.scrollLeft
  hasRightOverflowShadow.value = scrollWidth > clientWidth + 2 && remaining > 2

  const thead = el.querySelector('thead')
  if (thead) {
    headerRowHeightPx.value = Math.ceil(thead.getBoundingClientRect().height)
  }
}

const emptyTitle = computed(() => 'No PDFs yet')

const emptyDescription = computed(() =>
  'Upload PDFs above, or run a site crawl with inventory enabled to discover PDFs on your site.'
)

function onPaginationChange(nextPage: number) {
  scrollDataTableIntoView(tablePanelRef.value)
  table.value?.tableApi?.setPageIndex(nextPage - 1)
}

watch(
  () => pagination.value.pageIndex,
  (nextIndex, previousIndex) => {
    if (nextIndex === previousIndex) return
    scrollDataTableIntoView(tablePanelRef.value)
  }
)

watch(
  () => [props.documents.length, props.pageSize, columnVisibility.value, sorting.value] as const,
  async () => {
    await nextTick()
    updateScrollChrome()
  },
  { deep: true }
)

onMounted(() => {
  nextTick(() => updateScrollChrome())
  if (!import.meta.client) return
  window.addEventListener('resize', updateScrollChrome, { passive: true })
  const el = scrollRef.value
  if (el && typeof ResizeObserver !== 'undefined') {
    scrollResizeObserver = new ResizeObserver(() => updateScrollChrome())
    scrollResizeObserver.observe(el)
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('resize', updateScrollChrome)
  scrollResizeObserver?.disconnect()
  scrollResizeObserver = undefined
})
</script>

<template>
  <div ref="tablePanelRef" class="validated-pdfs-table-panel space-y-4">
    <DataTableToolbar v-if="!hideToolbar">
      <template #actions>
        <TableSearchInput
          v-model="globalFilter"
          placeholder="Search PDFs…"
          aria-label="Search PDFs"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-download"
          label="Export to CSV"
          @click="emit('export')"
        />
      </template>
    </DataTableToolbar>

    <div
      v-if="!documents.length && !loading"
      class="rounded-lg border border-default bg-elevated px-6 py-16 text-center"
    >
      <UIcon
        name="i-lucide-file-text"
        class="mx-auto mb-4 size-12 text-primary/60"
      />
      <p class="text-base font-medium text-highlighted">
        {{ emptyTitle }}
      </p>
      <p class="mt-1 text-sm text-muted">
        {{ emptyDescription }}
      </p>
    </div>

    <div v-else class="table-surface validated-pdfs-table-surface">
      <DataTableSkeleton
        v-if="showInitialSkeleton"
        :rows="pageSize"
        :layout="skeletonLayout"
      />
      <div
        v-else
        class="validated-pdfs-table-viewport"
      >
        <div
          ref="scrollRef"
          class="validated-pdfs-table-scroll"
          :class="{ 'validated-pdfs-table-scroll--overflow-right': hasRightOverflowShadow }"
          @scroll.passive="updateScrollChrome"
        >
          <UTable
            ref="table"
            v-model:global-filter="globalFilter"
            v-model:pagination="pagination"
            v-model:sorting="sorting"
            v-model:row-selection="rowSelection"
            v-model:column-visibility="columnVisibility"
            class="min-w-full"
            :data="documents"
            :columns="columns"
            :get-row-id="(row: PdfDocument) => row.id"
            :loading="stableLoading && !!documents.length"
            :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
            :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
            :ui="PDFS_TABLE_UI"
          >
            <template #loading>
              <DataTableSkeleton
                :rows="Math.min(pageSize, 5)"
                :layout="skeletonLayout"
                :show-header="false"
              />
            </template>
          </UTable>
        </div>

        <div
          class="validated-pdfs-right-shadow"
          :class="{ 'validated-pdfs-right-shadow--visible': hasRightOverflowShadow }"
          aria-hidden="true"
        />
        <div
          v-show="hasRightOverflowShadow && headerRowHeightPx > 0"
          class="validated-pdfs-header-cap"
          :style="{ height: `${headerRowHeightPx}px` }"
          aria-hidden="true"
        />
      </div>

      <div
        v-if="showTableFooter && !showInitialSkeleton"
        class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2"
      >
        <p
          v-if="footerSummary"
          class="text-xs text-muted"
        >
          {{ footerSummary }}
        </p>
        <div
          v-else
          class="flex-1"
        />
        <div class="ms-auto flex items-center gap-2">
          <UPagination
            v-if="showPagination"
            :page="(table?.tableApi?.getState().pagination.pageIndex ?? 0) + 1"
            :items-per-page="pagination.pageSize"
            :total="filteredRowCount"
            @update:page="onPaginationChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.validated-pdfs-table-surface {
  overflow: hidden;
  container-type: inline-size;
  container-name: validated-pdfs-table;
}

.validated-pdfs-table-viewport {
  position: relative;
  overflow: hidden;
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
}

.validated-pdfs-table-scroll {
  position: relative;
  min-width: 0;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
}

.validated-pdfs-table-scroll--overflow-right {
  box-shadow: inset -12px 0 12px -8px color-mix(in srgb, #000 12%, transparent 88%);
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll table) {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll th),
.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll td) {
  border-right: none;
  background-color: var(--table-surface-bg, var(--ui-bg));
}

/* Select gutter with horizontal padding; title width tracked to panel */
.validated-pdfs-table-panel :deep(.validated-pdfs-title-col) {
  width: 33cqi;
  min-width: 33cqi;
  max-width: 33cqi;
  box-sizing: border-box;
}

@supports not (width: 1cqi) {
  .validated-pdfs-table-panel :deep(.validated-pdfs-title-col) {
    width: 33%;
    min-width: 20rem;
    max-width: 33%;
  }
}

.validated-pdfs-table-panel :deep(td.validated-pdfs-title-col > *),
.validated-pdfs-table-panel :deep(th.validated-pdfs-title-col) {
  width: 100%;
  max-width: 100%;
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll thead th) {
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
  text-transform: none;
}

/* Match Issues expand/select gutter; slightly wider for checkbox breathing room */
.validated-pdfs-table-panel :deep(.validated-pdfs-select-col) {
  width: 3.25rem;
  min-width: 3.25rem;
  max-width: 3.25rem;
  padding-left: 0.625rem;
  padding-right: 0.625rem;
  box-sizing: border-box;
  box-shadow: none;
}

.validated-pdfs-table-panel :deep(thead th.validated-pdfs-select-col) {
  border-top-left-radius: 0.5rem;
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll tbody td) {
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll tbody tr:last-child td) {
  border-bottom: none;
}

.validated-pdfs-table-panel :deep(thead tr[data-slot='separator']) {
  display: none;
}

/* Sticky cols: opaque cover matching table surface. */
.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll .validated-pdfs-sticky-col) {
  position: sticky;
  z-index: 3;
  overflow: visible;
  background-color: var(--table-surface-bg, var(--ui-bg));
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll thead .validated-pdfs-sticky-col) {
  z-index: 5;
  background-color: var(--table-surface-bg, var(--ui-bg));
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll .validated-pdfs-sticky-col--1) {
  left: 0;
  z-index: 3;
  box-shadow: none;
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll thead .validated-pdfs-sticky-col--1) {
  z-index: 5;
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll .validated-pdfs-sticky-col--2) {
  left: 3.25rem;
  z-index: 4;
  overflow: visible;
  box-shadow: 6px 0 10px -8px color-mix(in srgb, #000 22%, transparent 78%);
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll .validated-pdfs-sticky-col--lead) {
  left: 0;
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll thead .validated-pdfs-sticky-col--lead) {
  border-top-left-radius: 0.5rem;
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll thead .validated-pdfs-sticky-col--2) {
  z-index: 6;
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll .validated-pdfs-sticky-col--2)::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: color-mix(in srgb, var(--ui-border) 92%, transparent 8%);
  pointer-events: none;
  z-index: 2;
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll tbody .validated-pdfs-sticky-col--2)::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 100%;
  width: 10px;
  pointer-events: none;
  z-index: 1;
  background: linear-gradient(
    to right,
    color-mix(in srgb, #000 14%, transparent 86%) 0%,
    transparent 100%
  );
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll thead .validated-pdfs-sticky-col--2)::after {
  display: none;
}

.validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll .validated-pdfs-center-col) {
  text-align: center;
}

.validated-pdfs-right-shadow {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 12;
  width: 12px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease;
  border-top-right-radius: 0.5rem;
  background: linear-gradient(
    to left,
    color-mix(in srgb, #000 14%, transparent 86%) 0%,
    color-mix(in srgb, #000 6%, transparent 94%) 50%,
    transparent 100%
  );
}

.validated-pdfs-right-shadow--visible {
  opacity: 1;
}

.validated-pdfs-header-cap {
  position: absolute;
  top: 0;
  right: 0;
  width: 12px;
  z-index: 13;
  pointer-events: none;
  border-top-right-radius: 0.5rem;
  background: linear-gradient(
    to right,
    transparent 0%,
    var(--table-surface-bg, var(--ui-bg)) 100%
  );
}

@media (max-width: 767px) {
  .validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll .validated-pdfs-sticky-col) {
    position: static;
    left: auto;
    z-index: auto;
    box-shadow: none;
    background-color: transparent;
  }

  .validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll thead .validated-pdfs-sticky-col) {
    background-color: transparent;
  }

  .validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll .validated-pdfs-sticky-col--2)::before,
  .validated-pdfs-table-panel :deep(.validated-pdfs-table-scroll .validated-pdfs-sticky-col--2)::after {
    display: none;
  }

  .validated-pdfs-table-scroll--overflow-right {
    box-shadow: inset -18px 0 18px -10px color-mix(in srgb, #000 20%, transparent 80%);
  }
}
</style>
