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
import { DATA_TABLE_UI } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'

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

const tablePanelRef = useTemplateRef<HTMLElement>('tablePanelRef')
const pagination = ref({ pageIndex: 0, pageSize: 20 })
const sorting = ref<SortingState>([
  { id: 'severity', desc: true },
  { id: 'issues', desc: true }
])

const stableLoading = useStableLoading(toRef(() => props.loading))

function sortableHeader(
  column: Column<SimulatorPageRow, unknown>,
  label: string,
  align: 'left' | 'right' | 'center' = 'left'
) {
  const isSorted = column.getIsSorted()
  const button = h(UButton, {
    color: 'neutral',
    variant: 'ghost',
    size: 'xs',
    label,
    icon: isSorted
      ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow')
      : 'i-lucide-arrow-up-down',
    class: align === 'left' ? '-ms-2' : '',
    ui: {
      base: 'font-medium',
      leadingIcon: 'size-3.5'
    },
    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
  })
  if (align === 'left') return button
  return h('div', {
    class: align === 'right' ? 'flex justify-end' : 'flex justify-center'
  }, [button])
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
      header: ({ column }) => sortableHeader(column, 'Issues', 'center'),
      meta: { class: { th: 'text-center', td: 'text-center tabular-nums' } },
      cell: ({ row }) => row.original.issueCount
    },
    {
      id: 'actions',
      enableSorting: false,
      header: '',
      meta: { class: { th: 'w-24', td: 'w-24 text-right' } },
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

const showPagination = computed(() => filteredRows.value.length > pagination.value.pageSize)
const showFooter = computed(() => !!props.footerSummary || showPagination.value)
const showInitialSkeleton = computed(() => stableLoading.value && !props.rows.length)

watch(globalFilter, () => {
  pagination.value.pageIndex = 0
})

function onPaginationChange(nextPage: number) {
  scrollDataTableIntoView(tablePanelRef.value)
  pagination.value.pageIndex = nextPage - 1
}
</script>

<template>
  <div ref="tablePanelRef" class="space-y-4">
    <div class="table-surface">
      <DataTableSkeleton
        v-if="showInitialSkeleton"
        :rows="8"
        :columns="showSiteColumn ? 6 : 5"
      />
      <UTable
        v-else
        v-model:sorting="sorting"
        v-model:pagination="pagination"
        :data="filteredRows"
        :columns="columns"
        :loading="stableLoading && !!rows.length"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
        :ui="{
          ...DATA_TABLE_UI,
          tr: 'cursor-pointer hover:bg-elevated/40 border-b border-default last:border-b-0'
        }"
      >
        <template #empty>
          <div class="py-10 text-center text-sm text-muted">
            No pages with open accessibility issues.
          </div>
        </template>
      </UTable>

      <div
        v-if="showFooter && !showInitialSkeleton"
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
          :page="pagination.pageIndex + 1"
          :total="filteredRows.length"
          :items-per-page="pagination.pageSize"
          class="ms-auto"
          @update:page="onPaginationChange"
        />
      </div>
    </div>
  </div>
</template>
