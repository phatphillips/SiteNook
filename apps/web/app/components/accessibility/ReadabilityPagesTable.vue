<script setup lang="ts">

import { h, resolveComponent } from 'vue'

import { upperFirst } from 'scule'

import { getPaginationRowModel, getSortedRowModel } from '@tanstack/vue-table'

import type { TableColumn } from '@nuxt/ui'

import type { Column, Row, SortingState } from '@tanstack/vue-table'

import type { ReadabilityMethodId, ReadabilityPageRow } from '~/utils/readabilityMethods'

import {

  buildReadabilityColumnLabels,

  formatReadabilityScoreDisplay,

  getReadabilityMethod,

  getReadabilityScoreStatus,

  readabilityScoreStatusClass

} from '~/utils/readabilityMethods'

import { parsePageUrl } from '~/utils/issueExplanation'

import { READABILITY_TABLE_SKELETON_COLUMNS } from '~/utils/dataTableSkeletonColumns'

import { DATA_TABLE_UI, dataTableSortableHeader } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'

const props = withDefaults(defineProps<{

  pages: ReadabilityPageRow[]

  enabledMethods: ReadabilityMethodId[]

  footerSummary?: string

  showSiteColumn?: boolean

  serverPaginated?: boolean

  total?: number

  page?: number

  pageSize?: number

  loading?: boolean

}>(), {

  footerSummary: undefined,

  showSiteColumn: false,

  serverPaginated: false,

  total: 0,

  page: 1,

  pageSize: 20,

  loading: false

})

const stableLoading = useStableLoading(toRef(() => props.loading))



const emit = defineEmits<{

  selectPage: [page: ReadabilityPageRow]

  'update:page': [page: number]

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

const tablePanelRef = useTemplateRef<HTMLElement>('tablePanelRef')



const pagination = ref({ pageIndex: 0, pageSize: props.pageSize })

const sorting = ref<SortingState>([{ id: 'word_count', desc: true }])

const columnVisibility = ref<Record<string, boolean>>({})
const rowSelection = ref<Record<string, boolean>>({})



watch(

  () => props.pageSize,

  (size) => {

    pagination.value.pageSize = size

  }

)



const tableGlobalFilter = computed({

  get: () => (props.serverPaginated ? '' : globalFilter.value),

  set: (value: string) => {

    if (!props.serverPaginated) globalFilter.value = value

  }

})



const columnLabels = computed(() => buildReadabilityColumnLabels(props.enabledMethods))

function sortableHeader(column: Column<ReadabilityPageRow, unknown>, label: string) {
  return dataTableSortableHeader(column, label)
}

const columns = computed<TableColumn<ReadabilityPageRow>[]>(() => {

  const siteColumn: TableColumn<ReadabilityPageRow>[] = props.showSiteColumn

    ? [{

        id: 'site',

        accessorFn: row => (row as ReadabilityPageRow & { siteName?: string }).siteName ?? '',

        header: 'Site',

        cell: ({ row }) => h('span', { class: 'text-sm' },

          (row.original as ReadabilityPageRow & { siteName?: string }).siteName ?? '—')

      }]

    : []



  const fixed: TableColumn<ReadabilityPageRow>[] = [

    {

      accessorKey: 'title',

      enableHiding: false,

      header: ({ column }) => sortableHeader(column, 'Title'),

      cell: ({ row }) => h('span', {

        class: 'text-sm text-default block truncate max-w-xs',

        title: row.original.title

      }, row.original.title || '—')

    },

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

      header: ({ column }) => sortableHeader(column, meta.shortLabel),

      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },

      cell: ({ row }) => {

        const score = row.original.scores[methodId]

        const status = getReadabilityScoreStatus(methodId, score)

        return h('span', {

          class: readabilityScoreStatusClass(status),

          title: meta.scale

        }, formatReadabilityScoreDisplay(methodId, score))

      }

    }

  })



  return [...siteColumn, ...fixed, ...methodColumns]

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

  },

  getColumnVisibility: () => columnVisibility.value

})



const filteredRowCount = computed(() => {

  if (props.serverPaginated) return props.total

  return table.value?.tableApi?.getFilteredRowModel().rows.length ?? props.pages.length

})



const showPagination = computed(() => {

  const pageSize = props.serverPaginated ? props.pageSize : pagination.value.pageSize

  return filteredRowCount.value > pageSize

})



const showInitialSkeleton = computed(

  () => stableLoading.value && !props.pages.length

)



const tablePaginationOptions = computed(() =>

  props.serverPaginated ? undefined : { getPaginationRowModel: getPaginationRowModel() }

)



const showTableFooter = computed(

  () => !!props.footerSummary || showPagination.value

)



function onRowSelect(_event: Event, row: Row<ReadabilityPageRow>) {

  emit('selectPage', row.original)

}

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

  <div ref="tablePanelRef" class="readability-table-panel space-y-4">

    <div class="table-surface">

      <DataTableSkeleton

        v-if="showInitialSkeleton"

        :rows="pageSize"

        :layout="READABILITY_TABLE_SKELETON_COLUMNS"

      />

      <UTable

        v-else

        ref="table"

        v-model:global-filter="tableGlobalFilter"

        v-model:pagination="pagination"
        
        v-model:row-selection="rowSelection"

        v-model:sorting="sorting"

        v-model:column-visibility="columnVisibility"

        :data="pages"

        :columns="columns"
        
        :get-row-id="(row: ReadabilityPageRow) => row.id"

        :loading="stableLoading && !!pages.length"

        :pagination-options="tablePaginationOptions"

        :sorting-options="{ getSortedRowModel: getSortedRowModel() }"

        :on-select="onRowSelect"

        :ui="{

          ...DATA_TABLE_UI,

          tr: 'cursor-pointer hover:bg-elevated/40 border-b border-default last:border-b-0'

        }"

      >

        <template #loading>

          <DataTableSkeleton

            :rows="Math.min(pageSize, 5)"

            :layout="READABILITY_TABLE_SKELETON_COLUMNS"

            :show-header="false"

          />

        </template>

      </UTable>



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

        <UPagination

          v-if="showPagination"

          :page="serverPaginated ? page : (table?.tableApi?.getState().pagination.pageIndex ?? 0) + 1"

          :items-per-page="serverPaginated ? pageSize : pagination.pageSize"

          :total="filteredRowCount"

          @update:page="onPaginationChange"

        />

      </div>

    </div>



    <p

      v-if="!pages.length && !loading"

      class="text-sm text-muted py-8 text-center"

    >

      No page data yet. Run a scan to populate readability scores.

    </p>

  </div>

</template>

