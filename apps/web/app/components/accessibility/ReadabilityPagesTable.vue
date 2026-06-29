<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { upperFirst } from 'scule'
import { getPaginationRowModel, getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/vue-table'
import type { ReadabilityMethodId, ReadabilityPageRow } from '~/utils/readabilityMethods'
import {
  buildReadabilityColumnLabels,
  formatReadabilityScore,
  getReadabilityMethod,
  getReadabilityScoreStatus,
  readabilityScoreStatusClass
} from '~/utils/readabilityMethods'
import { parsePageUrl } from '~/utils/issueExplanation'

const props = withDefaults(defineProps<{
  pages: ReadabilityPageRow[]
  enabledMethods: ReadabilityMethodId[]
  footerSummary?: string
}>(), {
  footerSummary: undefined
})

const emit = defineEmits<{
  selectPage: [page: ReadabilityPageRow]
}>()

const globalFilter = defineModel<string>('search', { default: '' })

const UButton = resolveComponent('UButton')
const table = useTemplateRef<{ tableApi?: {
  getAllColumns: () => Array<{ id: string, getCanHide: () => boolean, getIsVisible: () => boolean }>
  getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } | undefined
  getFilteredRowModel: () => { rows: unknown[] }
  getState: () => { pagination: { pageIndex: number } }
  setPageIndex: (i: number) => void
} }>('table')

const pagination = ref({ pageIndex: 0, pageSize: 20 })
const sorting = ref<SortingState>([{ id: 'word_count', desc: true }])
const columnVisibility = ref<Record<string, boolean>>({})

const columnLabels = computed(() => buildReadabilityColumnLabels(props.enabledMethods))

function sortableHeader(column: Column<ReadabilityPageRow, unknown>, label: string) {
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

const columns = computed<TableColumn<ReadabilityPageRow>[]>(() => {
  const fixed: TableColumn<ReadabilityPageRow>[] = [
    {
      id: 'url',
      accessorFn: row => `${row.url} ${row.title}`,
      header: ({ column }) => sortableHeader(column, 'Page URL'),
      cell: ({ row }) => {
        const parsed = parsePageUrl(row.original.url)
        return h('div', { class: 'min-w-0 max-w-md' }, [
          h('a', {
            href: row.original.url,
            target: '_blank',
            rel: 'noopener',
            class: 'text-sm text-primary hover:underline block truncate',
            title: row.original.url,
            onClick: (e: Event) => e.stopPropagation()
          }, parsed.path),
          h('span', { class: 'text-xs text-muted block truncate' }, parsed.domain)
        ])
      }
    },
    {
      accessorKey: 'title',
      header: ({ column }) => sortableHeader(column, 'Title'),
      cell: ({ row }) => h('span', {
        class: 'text-sm text-default block truncate max-w-xs',
        title: row.original.title
      }, row.original.title || '—')
    },
    {
      accessorKey: 'word_count',
      header: ({ column }) => sortableHeader(column, 'Words'),
      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
      cell: ({ row }) => row.original.word_count || '—'
    }
  ]

  const methodColumns: TableColumn<ReadabilityPageRow>[] = props.enabledMethods.map((methodId) => {
    const meta = getReadabilityMethod(methodId)
    return {
      id: methodId,
      accessorFn: row => row.scores[methodId] ?? -1,
      header: ({ column }) => sortableHeader(column, meta.badge),
      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
      cell: ({ row }) => {
        const score = row.original.scores[methodId]
        const status = getReadabilityScoreStatus(methodId, score)
        return h('span', {
          class: readabilityScoreStatusClass(status)
        }, formatReadabilityScore(score))
      }
    }
  })

  return [...fixed, ...methodColumns]
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
      label: columnLabels.value[column.id] ?? upperFirst(column.id),
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

const filteredRowCount = computed(
  () => table.value?.tableApi?.getFilteredRowModel().rows.length ?? props.pages.length
)

const showPagination = computed(
  () => filteredRowCount.value > pagination.value.pageSize
)

const showTableFooter = computed(
  () => !!props.footerSummary || showPagination.value
)

function onRowSelect(_event: Event, row: { original: ReadabilityPageRow }) {
  emit('selectPage', row.original)
}
</script>

<template>
  <div class="readability-table-panel space-y-4">
    <div class="table-surface">
      <UTable
        ref="table"
        v-model:global-filter="globalFilter"
        v-model:pagination="pagination"
        v-model:sorting="sorting"
        v-model:column-visibility="columnVisibility"
        :data="pages"
        :columns="columns"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
        :on-select="onRowSelect"
        :ui="{
          root: 'relative w-full',
          tr: 'cursor-pointer hover:bg-elevated/40'
        }"
      />

      <div
        v-if="showTableFooter"
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
          :page="(table?.tableApi?.getState().pagination.pageIndex ?? 0) + 1"
          :items-per-page="pagination.pageSize"
          :total="filteredRowCount"
          @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
        />
      </div>
    </div>

    <p v-if="!pages.length" class="text-sm text-muted py-8 text-center">
      No page data yet. Run a scan to populate readability scores.
    </p>
  </div>
</template>
