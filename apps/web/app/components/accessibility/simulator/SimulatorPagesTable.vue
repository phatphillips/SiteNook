<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { getPaginationRowModel, getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/vue-table'
import { parsePageUrl } from '~/utils/issueExplanation'
import {
  impactRank,
  severityBadgeColor,
  type SimulatorPageRow
} from '~/utils/simulatorPages'

const props = withDefaults(defineProps<{
  rows: SimulatorPageRow[]
  loading?: boolean
  footerSummary?: string
  showSiteColumn?: boolean
}>(), {
  loading: false,
  showSiteColumn: false
})

const globalFilter = defineModel<string>('search', { default: '' })

const emit = defineEmits<{
  select: [SimulatorPageRow]
}>()

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')

const pagination = ref({ pageIndex: 0, pageSize: 20 })
const sorting = ref<SortingState>([
  { id: 'severity', desc: true },
  { id: 'issues', desc: true }
])

function sortableHeader(column: Column<SimulatorPageRow, unknown>, label: string) {
  const isSorted = column.getIsSorted()
  return h(UButton, {
    color: 'neutral',
    variant: 'ghost',
    label,
    icon: isSorted
      ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow')
      : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
  })
}

const columns = computed<TableColumn<SimulatorPageRow>[]>(() => {
  const cols: TableColumn<SimulatorPageRow>[] = [
    {
      accessorKey: 'title',
      header: ({ column }) => sortableHeader(column, 'Title'),
      cell: ({ row }) => h('button', {
        type: 'button',
        class: 'text-sm text-default hover:text-highlighted truncate max-w-xs text-left',
        title: row.original.title || row.original.url,
        onClick: (e: MouseEvent) => {
          e.preventDefault()
          emit('select', row.original)
        }
      }, row.original.title || '—')
    },
    {
      accessorKey: 'url',
      header: ({ column }) => sortableHeader(column, 'Page URL'),
      cell: ({ row }) => {
        const parsed = parsePageUrl(row.original.url)
        return h('div', { class: 'min-w-0 max-w-md' }, [
          h('span', {
            class: 'text-sm text-primary block truncate',
            title: row.original.url
          }, parsed.path),
          h('span', { class: 'text-xs text-muted block truncate' }, parsed.domain)
        ])
      }
    }
  ]

  if (props.showSiteColumn) {
    cols.push({
      id: 'site',
      accessorFn: row => row.siteName || row.siteId,
      header: ({ column }) => sortableHeader(column, 'Site'),
      cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, row.original.siteName || '—')
    })
  }

  cols.push(
    {
      id: 'severity',
      accessorFn: row => impactRank(row.highestImpact),
      header: ({ column }) => sortableHeader(column, 'Severity'),
      cell: ({ row }) => h(UBadge, {
        color: severityBadgeColor(row.original.highestImpact),
        variant: 'subtle',
        size: 'sm'
      }, () => row.original.highestSeverityLabel)
    },
    {
      id: 'issues',
      accessorKey: 'issueCount',
      header: ({ column }) => sortableHeader(column, 'Issues'),
      meta: { class: { th: 'text-center', td: 'text-center tabular-nums' } },
      cell: ({ row }) => row.original.issueCount
    },
    {
      id: 'actions',
      enableSorting: false,
      header: '',
      cell: ({ row }) => h(UButton, {
        size: 'xs',
        color: 'neutral',
        variant: 'outline',
        label: 'Open',
        icon: 'i-lucide-eye',
        onClick: () => emit('select', row.original)
      })
    }
  )

  return cols
})

const filteredRows = computed(() => {
  const q = globalFilter.value.trim().toLowerCase()
  if (!q) return props.rows
  return props.rows.filter((row) => {
    return row.title.toLowerCase().includes(q)
      || row.url.toLowerCase().includes(q)
      || (row.siteName || '').toLowerCase().includes(q)
      || row.highestSeverityLabel.toLowerCase().includes(q)
  })
})
</script>

<template>
  <div class="space-y-3">
    <UTable
      :data="filteredRows"
      :columns="columns"
      :loading="loading"
      v-model:sorting="sorting"
      v-model:pagination="pagination"
      :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
      :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
    >
      <template #empty>
        <div class="py-10 text-center text-sm text-muted">
          No pages with open accessibility issues.
        </div>
      </template>
    </UTable>

    <div
      v-if="footerSummary || filteredRows.length > pagination.pageSize"
      class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"
    >
      <p>{{ footerSummary }}</p>
      <UPagination
        v-if="filteredRows.length > pagination.pageSize"
        :default-page="pagination.pageIndex + 1"
        :total="filteredRows.length"
        :items-per-page="pagination.pageSize"
        @update:page="(p: number) => { pagination.pageIndex = p - 1 }"
      />
    </div>
  </div>
</template>
