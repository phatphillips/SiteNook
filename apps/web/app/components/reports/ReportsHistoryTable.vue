<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/vue-table'
import type { ReportJobRecord } from '~/types/reports'
import { DATA_TABLE_UI, dataTableSortableHeader } from '~/utils/dataTableUi'
import {
  clampReportProgress,
  isReportJobActive,
  reportStatusHeadline
} from '~/utils/reportJobProgress'

const props = withDefaults(defineProps<{
  jobs: ReportJobRecord[]
  loading?: boolean
  total?: number
  page?: number
  perPage?: number
}>(), {
  loading: false,
  total: 0,
  page: 1,
  perPage: 20
})

const emit = defineEmits<{
  open: [job: ReportJobRecord]
  'update:page': [page: number]
}>()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UCheckbox = resolveComponent('UCheckbox')

const table = useTemplateRef<{
  tableApi?: {
    getAllColumns: () => Array<{ id: string, getCanHide: () => boolean, getIsVisible: () => boolean }>
    getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } | undefined
    getFilteredSelectedRowModel: () => { rows: Array<{ original: ReportJobRecord }> }
    getRowModel: () => { rows?: Array<{ original: ReportJobRecord }> }
  }
}>('table')
const rowSelection = ref<Record<string, boolean>>({})
const sorting = ref<SortingState>([{ id: 'created', desc: true }])
const columnVisibility = ref<Record<string, boolean>>({})

const COLUMN_LABELS: Record<string, string> = {
  scope: 'Scope',
  format: 'Format',
  status: 'Status',
  created: 'Created'
}

function openJob(job: ReportJobRecord) {
  emit('open', job)
}

function onTableClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return
  if (target.closest('button, input, a, [role="checkbox"], label')) return
  const rowEl = target.closest('tbody tr')
  if (!rowEl?.parentElement) return
  const index = Array.from(rowEl.parentElement.children).indexOf(rowEl)
  if (index < 0) return
  const row = table.value?.tableApi?.getRowModel()?.rows?.[index] as { original: ReportJobRecord } | undefined
  if (row?.original) openJob(row.original)
}

function formatJobDate(job: ReportJobRecord): string {
  const raw = job.started_at || job.completed_at || job.created
  if (!raw) return '—'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function jobCreatedMs(job: ReportJobRecord): number {
  const raw = job.started_at || job.completed_at || job.created
  if (!raw) return 0
  const ms = new Date(raw).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

function scopeLabel(job: ReportJobRecord): string {
  if (job.include_all_sites) return 'All sites'
  return job.expand?.site?.name || 'Single site'
}

function statusColor(status: ReportJobRecord['status']): 'success' | 'error' | 'warning' | 'neutral' {
  if (status === 'complete') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'processing' || status === 'pending') return 'warning'
  return 'neutral'
}

function sortableHeader(
  column: Column<ReportJobRecord, unknown>,
  label: string
) {
  return dataTableSortableHeader(column, label)
}

const tableUi = {
  ...DATA_TABLE_UI,
  tr: `${DATA_TABLE_UI.tr} cursor-pointer hover:bg-elevated/40`
}

const columns = computed<TableColumn<ReportJobRecord>[]>(() => [
  {
    id: 'select',
    enableHiding: false,
    enableSorting: false,
    meta: {
      class: {
        th: 'w-10 !px-2',
        td: 'w-10 !px-2'
      }
    },
    header: ({ table: t }) =>
      h(UCheckbox, {
        'modelValue': t.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : t.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          t.toggleAllPageRowsSelected(!!value),
        'ariaLabel': 'Select all reports',
        'onClick': (e: Event) => e.stopPropagation()
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        'modelValue': row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'ariaLabel': 'Select report',
        'onClick': (e: Event) => e.stopPropagation()
      })
  },
  {
    id: 'scope',
    accessorFn: row => scopeLabel(row),
    header: ({ column }) => sortableHeader(column, 'Scope'),
    cell: ({ row }) => h('div', {
      class: 'text-sm font-medium py-1'
    }, scopeLabel(row.original))
  },
  {
    accessorKey: 'format',
    header: ({ column }) => sortableHeader(column, 'Format'),
    meta: { class: { th: 'w-24', td: 'w-24' } },
    cell: ({ row }) => h('div', {
      class: 'inline-flex py-1'
    }, [
      h(UBadge, { variant: 'subtle' }, () => String(row.original.format).toUpperCase())
    ])
  },
  {
    accessorKey: 'status',
    header: ({ column }) => sortableHeader(column, 'Status'),
    cell: ({ row }) => {
      const job = row.original
      if (isReportJobActive(job.status)) {
        const progress = clampReportProgress(job.progress)
        return h('div', {
          class: 'min-w-[9rem] space-y-1.5 py-1'
        }, [
          h('div', { class: 'flex items-center justify-between gap-2 text-xs text-muted' }, [
            h('span', { class: 'truncate' }, reportStatusHeadline(job.status, job.progress_label)),
            h('span', { class: 'tabular-nums shrink-0' }, `${progress}%`)
          ]),
          h('div', { class: 'h-1.5 overflow-hidden rounded-full bg-elevated' }, [
            h('div', {
              class: 'h-full rounded-full bg-primary transition-[width] duration-500 ease-out',
              style: { width: `${progress}%` }
            })
          ])
        ])
      }
      return h('div', {
        class: 'inline-flex py-1'
      }, [
        h(UBadge, { variant: 'subtle', color: statusColor(job.status) }, () => job.status)
      ])
    }
  },
  {
    id: 'created',
    accessorFn: row => jobCreatedMs(row),
    header: ({ column }) => sortableHeader(column, 'Created'),
    meta: { class: { th: 'w-44', td: 'w-44' } },
    cell: ({ row }) => h('div', {
      class: 'text-sm text-muted py-1'
    }, formatJobDate(row.original))
  }
])

const selectedIds = computed(() =>
  (table.value?.tableApi?.getFilteredSelectedRowModel().rows || [])
    .map((row: { original: ReportJobRecord }) => row.original.id)
)

const selectedJobs = computed(() =>
  (table.value?.tableApi?.getFilteredSelectedRowModel().rows || [])
    .map((row: { original: ReportJobRecord }) => row.original)
)

const selectedCount = computed(() => selectedIds.value.length)

const showPagination = computed(() => props.total > props.perPage)

const footerSummary = computed(() => {
  if (!props.total) return ''
  const start = props.total === 0 ? 0 : (props.page - 1) * props.perPage + 1
  const end = Math.min(props.page * props.perPage, props.total)
  return `Showing ${start}-${end} of ${props.total.toLocaleString()}`
})

watch(() => props.jobs, () => {
  rowSelection.value = {}
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
      label: COLUMN_LABELS[column.id] ?? column.id,
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
  selectedCount,
  selectedIds,
  selectedJobs,
  get columnMenuItems() {
    return columnMenuItems.value
  },
  clearSelection() {
    rowSelection.value = {}
  }
})
</script>

<template>
  <div class="space-y-3">
    <div class="table-surface reports-history-table" @click="onTableClick">
      <DataTableSkeleton v-if="loading && !jobs.length" :rows="8" :columns="5" />
      <UTable
        v-else
        ref="table"
        v-model:row-selection="rowSelection"
        v-model:sorting="sorting"
        v-model:column-visibility="columnVisibility"
        :data="jobs"
        :columns="columns"
        :loading="loading && !!jobs.length"
        :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
        :ui="tableUi"
        :get-row-id="(row: ReportJobRecord) => row.id"
        :empty-state="{ icon: 'i-lucide-file-stack', label: 'No reports yet', description: 'Create your first report export.' }"
      />

      <div
        v-if="(showPagination || footerSummary) && !(loading && !jobs.length)"
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
        <UPagination
          v-if="showPagination"
          :page="page"
          :items-per-page="perPage"
          :total="total"
          class="ms-auto"
          @update:page="(p: number) => emit('update:page', p)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.reports-history-table :deep(tbody tr) {
  cursor: pointer;
}
.reports-history-table :deep(tbody td) {
  vertical-align: middle;
}
</style>
