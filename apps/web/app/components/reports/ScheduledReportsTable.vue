<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
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

function scopeLabel(schedule: ReportScheduleRecord): string {
  if (schedule.include_all_sites !== false) return 'All sites'
  return schedule.expand?.site?.name || 'Single site'
}

function recipientCount(schedule: ReportScheduleRecord): number {
  return Array.isArray(schedule.recipient_ids) ? schedule.recipient_ids.length : 0
}

const showPagination = computed(() => props.total > props.perPage)

const columns = computed<TableColumn<ReportScheduleRecord>[]>(() => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => h('div', { class: 'min-w-[10rem]' }, [
      h('p', { class: 'text-sm font-medium' }, row.original.name),
      h('p', { class: 'text-xs text-muted' }, scopeLabel(row.original))
    ])
  },
  {
    accessorKey: 'format',
    header: 'Format',
    cell: ({ row }) => h(UBadge, { variant: 'subtle' }, () => String(row.original.format).toUpperCase())
  },
  {
    id: 'cadence',
    header: 'Cadence',
    cell: ({ row }) => h('span', { class: 'text-sm capitalize' }, formatReportCadenceLabel(row.original.cadence))
  },
  {
    id: 'sections',
    header: 'Sections',
    cell: ({ row }) => h('span', { class: 'text-sm tabular-nums' }, String(countSelectedReportSections(row.original.sections)))
  },
  {
    id: 'recipients',
    header: 'Recipients',
    cell: ({ row }) => h('span', { class: 'text-sm tabular-nums' }, String(recipientCount(row.original)))
  },
  {
    id: 'next',
    header: 'Next run',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatNextReportRunLabel(row.original.enabled, row.original.next_run_at))
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => h(
      UBadge,
      { variant: 'subtle', color: row.original.enabled ? 'success' : 'neutral' },
      () => (row.original.enabled ? 'Active' : 'Paused')
    )
  },
  {
    id: 'actions',
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
</script>

<template>
  <div class="space-y-3">
    <div class="table-surface">
      <DataTableSkeleton v-if="loading && !schedules.length" :rows="6" :columns="8" />
      <UTable
        v-else
        :data="schedules"
        :columns="columns"
        :loading="loading && !!schedules.length"
        :ui="DATA_TABLE_UI"
        :empty-state="{
          icon: 'i-lucide-calendar-clock',
          label: 'No scheduled reports',
          description: 'Create a schedule to email report links on a cadence.'
        }"
      />
    </div>

    <div
      v-if="showPagination"
      class="flex justify-end"
    >
      <UPagination
        :page="page"
        :items-per-page="perPage"
        :total="total"
        @update:page="(p: number) => emit('update:page', p)"
      />
    </div>
  </div>
</template>
