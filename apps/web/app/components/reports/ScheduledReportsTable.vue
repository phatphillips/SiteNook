<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/vue-table'
import type { ReportScheduleRecord } from '~/types/reports'
import { DATA_TABLE_UI } from '~/utils/dataTableUi'
import {
  formatNextReportRunLabel,
  formatReportCadenceLabel
} from '~/utils/reportSchedule'
import { countSelectedReportSections } from '~/utils/reportSections'

const props = withDefaults(defineProps<{
  schedules: ReportScheduleRecord[]
  loading?: boolean
  total?: number
  page?: number
  perPage?: number
  deletingId?: string | null
  runningId?: string | null
  togglingId?: string | null
}>(), {
  loading: false,
  total: 0,
  page: 1,
  perPage: 20,
  deletingId: null,
  runningId: null,
  togglingId: null
})

const emit = defineEmits<{
  edit: [schedule: ReportScheduleRecord]
  toggle: [schedule: ReportScheduleRecord]
  run: [schedule: ReportScheduleRecord]
  remove: [schedule: ReportScheduleRecord]
  'update:page': [page: number]
}>()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const sorting = ref<SortingState>([{ id: 'name', desc: false }])
const columnVisibility = ref<Record<string, boolean>>({})
const table = useTemplateRef<{
  tableApi?: {
    getAllColumns: () => Array<{ id: string, getCanHide: () => boolean, getIsVisible: () => boolean }>
    getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } | undefined
  }
}>('table')

const COLUMN_LABELS: Record<string, string> = {
  name: 'Name',
  format: 'Format',
  cadence: 'Cadence',
  sections: 'Sections',
  recipients: 'Recipients',
  next: 'Next run',
  status: 'Status'
}

function scopeLabel(schedule: ReportScheduleRecord): string {
  if (schedule.include_all_sites !== false) return 'All sites'
  return schedule.expand?.site?.name || 'Single site'
}

function recipientCount(schedule: ReportScheduleRecord): number {
  return Array.isArray(schedule.recipient_ids) ? schedule.recipient_ids.length : 0
}

function nextRunMs(schedule: ReportScheduleRecord): number {
  if (!schedule.next_run_at) return 0
  const ms = new Date(schedule.next_run_at).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

function sortableHeader(
  column: Column<ReportScheduleRecord, unknown>,
  label: string
) {
  const isSorted = column.getIsSorted()
  return h(UButton, {
    color: 'neutral',
    variant: 'ghost',
    size: 'xs',
    label,
    icon: isSorted
      ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow')
      : 'i-lucide-arrow-up-down',
    class: '-ms-2',
    ui: {
      base: 'font-medium',
      leadingIcon: 'size-3.5'
    },
    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
  })
}

const showPagination = computed(() => props.total > props.perPage)

const footerSummary = computed(() => {
  if (!props.total) return ''
  const start = props.total === 0 ? 0 : (props.page - 1) * props.perPage + 1
  const end = Math.min(props.page * props.perPage, props.total)
  return `Showing ${start}-${end} of ${props.total.toLocaleString()}`
})

const columns = computed<TableColumn<ReportScheduleRecord>[]>(() => [
  {
    accessorKey: 'name',
    header: ({ column }) => sortableHeader(column, 'Name'),
    cell: ({ row }) => h('div', { class: 'min-w-[10rem]' }, [
      h('p', { class: 'text-sm font-medium' }, row.original.name),
      h('p', { class: 'text-xs text-muted' }, scopeLabel(row.original))
    ])
  },
  {
    accessorKey: 'format',
    header: ({ column }) => sortableHeader(column, 'Format'),
    cell: ({ row }) => h(UBadge, { variant: 'subtle' }, () => String(row.original.format).toUpperCase())
  },
  {
    id: 'cadence',
    accessorFn: row => row.cadence,
    header: ({ column }) => sortableHeader(column, 'Cadence'),
    cell: ({ row }) => h('span', { class: 'text-sm capitalize' }, formatReportCadenceLabel(row.original.cadence))
  },
  {
    id: 'sections',
    accessorFn: row => countSelectedReportSections(row.sections),
    header: ({ column }) => sortableHeader(column, 'Sections'),
    cell: ({ row }) => h('span', { class: 'text-sm tabular-nums' }, String(countSelectedReportSections(row.original.sections)))
  },
  {
    id: 'recipients',
    accessorFn: row => recipientCount(row),
    header: ({ column }) => sortableHeader(column, 'Recipients'),
    cell: ({ row }) => h('span', { class: 'text-sm tabular-nums' }, String(recipientCount(row.original)))
  },
  {
    id: 'next',
    accessorFn: row => nextRunMs(row),
    header: ({ column }) => sortableHeader(column, 'Next run'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatNextReportRunLabel(row.original.enabled, row.original.next_run_at))
  },
  {
    id: 'status',
    accessorFn: row => (row.enabled ? 1 : 0),
    header: ({ column }) => sortableHeader(column, 'Status'),
    cell: ({ row }) => h(
      UBadge,
      { variant: 'subtle', color: row.original.enabled ? 'success' : 'neutral' },
      () => (row.original.enabled ? 'Active' : 'Paused')
    )
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    header: '',
    cell: ({ row }) => {
      const schedule = row.original
      const isDeleting = props.deletingId === schedule.id
      const isRunning = props.runningId === schedule.id
      const isToggling = props.togglingId === schedule.id
      return h('div', { class: 'flex items-center justify-end gap-1' }, [
        h(UButton, {
          size: 'xs',
          color: 'neutral',
          variant: 'ghost',
          icon: 'i-lucide-pencil',
          'aria-label': 'Edit schedule',
          onClick: () => emit('edit', schedule)
        }),
        h(UDropdownMenu, {
          content: { align: 'end' },
          items: [[
            {
              label: schedule.enabled ? 'Pause' : 'Resume',
              icon: schedule.enabled ? 'i-lucide-pause' : 'i-lucide-play',
              disabled: isToggling,
              onSelect: () => emit('toggle', schedule)
            },
            {
              label: 'Run now',
              icon: 'i-lucide-zap',
              disabled: isRunning,
              onSelect: () => emit('run', schedule)
            },
            {
              label: 'Delete',
              icon: 'i-lucide-trash-2',
              color: 'error',
              disabled: isDeleting,
              onSelect: () => emit('remove', schedule)
            }
          ]]
        }, () => h(UButton, {
          size: 'xs',
          color: 'neutral',
          variant: 'ghost',
          icon: 'i-lucide-ellipsis',
          loading: isDeleting || isRunning || isToggling,
          'aria-label': 'Schedule actions'
        }))
      ])
    }
  }
])

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
  get columnMenuItems() {
    return columnMenuItems.value
  }
})
</script>

<template>
  <div class="space-y-3">
    <div class="table-surface">
      <DataTableSkeleton v-if="loading && !schedules.length" :rows="6" :columns="8" />
      <UTable
        v-else
        ref="table"
        v-model:sorting="sorting"
        v-model:column-visibility="columnVisibility"
        :data="schedules"
        :columns="columns"
        :loading="loading && !!schedules.length"
        :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
        :ui="DATA_TABLE_UI"
        :empty-state="{
          icon: 'i-lucide-calendar-clock',
          label: 'No scheduled reports',
          description: 'Create a schedule to email report links on a cadence.'
        }"
      />

      <div
        v-if="(showPagination || footerSummary) && !(loading && !schedules.length)"
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
