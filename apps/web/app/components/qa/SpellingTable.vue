<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { upperFirst } from 'scule'
import { getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/vue-table'
import type { SpellingIssue } from '~/types/sitenook'
import {
  SPELLING_TABLE_SKELETON_COLUMNS,
  SPELLING_TABLE_WITH_SITE_SKELETON_COLUMNS
} from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'
import { parsePageUrl } from '~/utils/issueExplanation'

type SpellingRow = SpellingIssue & { siteName?: string }

const props = withDefaults(defineProps<{
  items: SpellingIssue[]
  showSiteColumn?: boolean
  serverPaginated?: boolean
  total?: number
  page?: number
  pageSize?: number
  loading?: boolean
  footerSummary?: string
  /** When false, parent owns Misspellings / Review tabs in the toolbar. */
  showTabs?: boolean
  tab?: 'errors' | 'review'
}>(), {
  showSiteColumn: false,
  serverPaginated: false,
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  footerSummary: undefined,
  showTabs: true,
  tab: 'errors'
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:tab': [tab: 'errors' | 'review']
}>()

const UButton = resolveComponent('UButton')
const globalFilter = defineModel<string>('search', { default: '' })
const dictionary = ref<string[]>([])
const newWord = ref('')
const sorting = ref<SortingState>([{ id: 'word', desc: false }])
const columnVisibility = ref<Record<string, boolean>>({})
const table = useTemplateRef<{
  tableApi?: {
    getAllColumns: () => Array<{ id: string, getCanHide: () => boolean, getIsVisible: () => boolean }>
    getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } | undefined
  }
}>('table')

const tabModel = computed({
  get: () => props.tab,
  set: value => emit('update:tab', value)
})

const baseRows = computed(() =>
  props.serverPaginated
    ? props.items
    : props.items.filter(i =>
        props.tab === 'errors' ? i.confidence === 'error' : i.confidence === 'review'
      )
)

const displayed = computed(() => {
  const q = globalFilter.value.trim().toLowerCase()
  if (!q) return baseRows.value
  return baseRows.value.filter((row) => {
    const site = (row as SpellingRow).siteName?.toLowerCase() || ''
    const pageUrl = row.expand?.page?.url?.toLowerCase() || ''
    return row.word.toLowerCase().includes(q)
      || (row.context || '').toLowerCase().includes(q)
      || pageUrl.includes(q)
      || site.includes(q)
  })
})

const skeletonLayout = computed(() =>
  props.showSiteColumn
    ? SPELLING_TABLE_WITH_SITE_SKELETON_COLUMNS
    : SPELLING_TABLE_SKELETON_COLUMNS
)

const COLUMN_LABELS: Record<string, string> = {
  site: 'Site',
  word: 'Word',
  context: 'Context',
  page: 'Page URL'
}

function sortableHeader(
  column: Column<SpellingIssue, unknown>,
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

function pageUrlCell(url: string) {
  if (!url) return '—'
  const parsed = parsePageUrl(url)
  return h('div', { class: 'min-w-0 max-w-md' }, [
    h('a', {
      href: url,
      target: '_blank',
      rel: 'noopener',
      class: 'text-sm text-primary hover:underline block truncate',
      title: url
    }, parsed.path),
    h('span', { class: 'text-xs text-muted block truncate' }, parsed.domain)
  ])
}

const columns = computed((): TableColumn<SpellingIssue>[] => [
  ...(props.showSiteColumn
    ? [{
        id: 'site',
        accessorFn: (row: SpellingIssue) => (row as SpellingRow).siteName ?? '',
        header: ({ column }: { column: Column<SpellingIssue, unknown> }) =>
          sortableHeader(column, 'Site'),
        cell: ({ row }: { row: { original: SpellingRow } }) =>
          h('span', { class: 'text-sm' }, row.original.siteName || '—')
      }]
    : []),
  {
    accessorKey: 'word',
    enableHiding: false,
    header: ({ column }) => sortableHeader(column, 'Word'),
    cell: ({ row }) => h('span', { class: 'text-sm font-medium' }, row.original.word)
  },
  {
    accessorKey: 'context',
    header: ({ column }) => sortableHeader(column, 'Context'),
    cell: ({ row }) => h('span', {
      class: 'text-sm text-muted line-clamp-2',
      title: row.original.context
    }, row.original.context || '—')
  },
  {
    id: 'page',
    accessorFn: row => row.expand?.page?.url || '',
    header: ({ column }) => sortableHeader(column, 'Page URL'),
    cell: ({ row }) => pageUrlCell(row.original.expand?.page?.url || '')
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
      label: COLUMN_LABELS[column.id] ?? upperFirst(column.id),
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

const stableLoading = useStableLoading(toRef(() => props.loading))

const showInitialSkeleton = computed(
  () => stableLoading.value && !props.items.length
)

const showPagination = computed(
  () => props.serverPaginated && props.total > props.pageSize
)

const resolvedFooterSummary = computed(() => {
  if (props.footerSummary) return props.footerSummary
  if (!showPagination.value) return ''
  const pageStart = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1
  const pageEnd = Math.min(props.page * props.pageSize, props.total)
  return `Showing ${pageStart}-${pageEnd} of ${props.total.toLocaleString()}`
})

function addWord() {
  if (newWord.value.trim()) {
    dictionary.value.push(newWord.value.trim())
    newWord.value = ''
  }
}

const tablePanelRef = useTemplateRef<HTMLElement>('tablePanelRef')

function onPaginationChange(nextPage: number) {
  scrollDataTableIntoView(tablePanelRef.value)
  emit('update:page', nextPage)
}

watch(
  () => props.page,
  (nextPage, previousPage) => {
    if (!props.serverPaginated || nextPage === previousPage) return
    scrollDataTableIntoView(tablePanelRef.value)
  }
)

defineExpose({
  get columnMenuItems() {
    return columnMenuItems.value
  },
  getColumnVisibility: () => columnVisibility.value
})
</script>

<template>
  <div class="grid lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2 space-y-4">
      <div
        v-if="showTabs"
        class="flex gap-2"
      >
        <UButton
          :variant="tabModel === 'errors' ? 'solid' : 'outline'"
          @click="tabModel = 'errors'"
        >
          Misspellings
        </UButton>
        <UButton
          :variant="tabModel === 'review' ? 'solid' : 'outline'"
          @click="tabModel = 'review'"
        >
          Words to Review
        </UButton>
      </div>

      <div ref="tablePanelRef" class="table-surface overflow-x-auto">
        <DataTableSkeleton
          v-if="showInitialSkeleton"
          :rows="pageSize"
          :layout="skeletonLayout"
        />
        <UTable
          v-else
          ref="table"
          v-model:sorting="sorting"
          v-model:column-visibility="columnVisibility"
          :data="displayed"
          :columns="columns"
          :loading="stableLoading && !!items.length"
          :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
          :ui="{
            ...DATA_TABLE_UI,
            base: 'w-full min-w-[40rem] border-collapse'
          }"
        >
          <template #loading>
            <DataTableSkeleton
              :rows="Math.min(pageSize, 5)"
              :layout="skeletonLayout"
              :show-header="false"
            />
          </template>
          <template #empty>
            <div class="py-10 text-center text-sm text-muted">
              No spelling issues in this category yet.
            </div>
          </template>
        </UTable>

        <div
          v-if="(showPagination || resolvedFooterSummary) && !showInitialSkeleton"
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
            :page="page"
            :items-per-page="pageSize"
            :total="total"
            class="ms-auto"
            @update:page="onPaginationChange"
          />
        </div>
      </div>
    </div>

    <div class="table-surface p-4 space-y-3 h-fit">
      <h3 class="text-sm font-medium">
        Custom Dictionary
      </h3>
      <div class="flex gap-2">
        <UInput
          v-model="newWord"
          placeholder="Add word…"
          class="flex-1"
        />
        <UButton @click="addWord">
          Add
        </UButton>
      </div>
      <ul class="space-y-1">
        <li
          v-for="word in dictionary"
          :key="word"
          class="text-sm"
        >
          {{ word }}
        </li>
      </ul>
      <p
        v-if="!dictionary.length"
        class="text-sm text-muted"
      >
        No custom words yet
      </p>
    </div>
  </div>
</template>
