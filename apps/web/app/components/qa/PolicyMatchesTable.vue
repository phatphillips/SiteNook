<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { upperFirst } from 'scule'
import { getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/vue-table'
import type { PolicyMatch } from '~/types/sitenook'
import {
  POLICY_MATCHES_TABLE_SKELETON_COLUMNS,
  POLICY_MATCHES_TABLE_WITH_SITE_SKELETON_COLUMNS
} from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'
import { parsePageUrl } from '~/utils/issueExplanation'

export type PolicyMatchStatusFilter = 'open' | 'dismissed' | 'all'

type PolicyMatchRow = PolicyMatch & { siteName?: string }

const props = withDefaults(defineProps<{
  items: PolicyMatchRow[]
  showSiteColumn?: boolean
  serverPaginated?: boolean
  total?: number
  page?: number
  pageSize?: number
  loading?: boolean
  footerSummary?: string
  /** When false, parent owns Open / Dismissed / All tabs in the toolbar. */
  showStatusFilters?: boolean
  statusFilter?: PolicyMatchStatusFilter
}>(), {
  showSiteColumn: false,
  serverPaginated: false,
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  footerSummary: undefined,
  showStatusFilters: true,
  statusFilter: 'open'
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:statusFilter': [status: PolicyMatchStatusFilter]
  action: [payload: { issueIds: string[], action: 'dismiss' | 'reopen' | 'fixed' }]
}>()

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const globalFilter = defineModel<string>('search', { default: '' })
const sorting = ref<SortingState>([])
const columnVisibility = ref<Record<string, boolean>>({})
const table = useTemplateRef<{
  tableApi?: {
    getAllColumns: () => Array<{ id: string, getCanHide: () => boolean, getIsVisible: () => boolean }>
    getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } | undefined
  }
}>('table')

const statusModel = computed({
  get: () => props.statusFilter,
  set: value => emit('update:statusFilter', value)
})

const baseRows = computed(() => {
  if (props.serverPaginated) return props.items
  if (props.statusFilter === 'all') return props.items
  return props.items.filter(item => item.status === props.statusFilter)
})

const displayed = computed(() => {
  const q = globalFilter.value.trim().toLowerCase()
  if (!q) return baseRows.value
  return baseRows.value.filter((row) => {
    const policy = (row.expand?.policy?.name || row.policy || '').toLowerCase()
    const pageUrl = (row.expand?.page?.url || '').toLowerCase()
    const site = (row.siteName || '').toLowerCase()
    return policy.includes(q)
      || (row.matched_text || '').toLowerCase().includes(q)
      || (row.context || '').toLowerCase().includes(q)
      || pageUrl.includes(q)
      || site.includes(q)
      || row.status.toLowerCase().includes(q)
  })
})

const skeletonLayout = computed(() =>
  props.showSiteColumn
    ? POLICY_MATCHES_TABLE_WITH_SITE_SKELETON_COLUMNS
    : POLICY_MATCHES_TABLE_SKELETON_COLUMNS
)

const COLUMN_LABELS: Record<string, string> = {
  site: 'Site',
  policy: 'Policy',
  matched_text: 'Matched Text',
  context: 'Context',
  page: 'Page URL',
  severity: 'Severity',
  status: 'Status',
  actions: 'Actions'
}

function sortableHeader(
  column: Column<PolicyMatchRow, unknown>,
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

function runAction(issueId: string, action: 'dismiss' | 'reopen' | 'fixed') {
  emit('action', { issueIds: [issueId], action })
}

const columns = computed((): TableColumn<PolicyMatchRow>[] => [
  ...(props.showSiteColumn
    ? [{
        id: 'site',
        accessorFn: (row: PolicyMatchRow) => row.siteName ?? '',
        header: ({ column }: { column: Column<PolicyMatchRow, unknown> }) =>
          sortableHeader(column, 'Site'),
        cell: ({ row }: { row: { original: PolicyMatchRow } }) =>
          h('span', { class: 'text-sm' }, row.original.siteName || '—')
      }]
    : []),
  {
    id: 'policy',
    enableHiding: false,
    accessorFn: row => row.expand?.policy?.name || row.policy,
    header: ({ column }) => sortableHeader(column, 'Policy'),
    cell: ({ row }) => h(
      'span',
      { class: 'text-sm' },
      row.original.expand?.policy?.name || row.original.policy
    )
  },
  {
    accessorKey: 'matched_text',
    header: ({ column }) => sortableHeader(column, 'Matched Text'),
    cell: ({ row }) => h('code', { class: 'text-xs' }, row.original.matched_text)
  },
  {
    accessorKey: 'context',
    header: ({ column }) => sortableHeader(column, 'Context'),
    cell: ({ row }) => h('span', {
      class: 'line-clamp-2 text-sm text-muted',
      title: row.original.context
    }, row.original.context || '—')
  },
  {
    id: 'page',
    accessorFn: row => row.expand?.page?.url || '',
    header: ({ column }) => sortableHeader(column, 'Page URL'),
    cell: ({ row }) => pageUrlCell(row.original.expand?.page?.url || '')
  },
  {
    id: 'severity',
    accessorFn: row => row.expand?.policy?.severity || '',
    header: ({ column }) => sortableHeader(column, 'Severity'),
    cell: ({ row }) => h(UBadge, {
      color: row.original.expand?.policy?.severity === 'error' ? 'error' : 'warning',
      variant: 'subtle'
    }, () => row.original.expand?.policy?.severity || '—')
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({ column }) => sortableHeader(column, 'Status'),
    cell: ({ row }) => h(UBadge, { variant: 'subtle' }, () => row.original.status)
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    header: '',
    meta: { class: { th: 'w-40', td: 'w-40' } },
    cell: ({ row }) => {
      const status = row.original.status
      const buttons = []
      if (status === 'open') {
        buttons.push(
          h(UButton, {
            size: 'xs',
            color: 'neutral',
            variant: 'ghost',
            label: 'Dismiss',
            onClick: () => runAction(row.original.id, 'dismiss')
          }),
          h(UButton, {
            size: 'xs',
            color: 'neutral',
            variant: 'ghost',
            label: 'Fixed',
            onClick: () => runAction(row.original.id, 'fixed')
          })
        )
      } else {
        buttons.push(
          h(UButton, {
            size: 'xs',
            color: 'neutral',
            variant: 'ghost',
            label: 'Reopen',
            onClick: () => runAction(row.original.id, 'reopen')
          })
        )
      }
      return h('div', { class: 'flex justify-end gap-1' }, buttons)
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

const showFooter = computed(
  () => showPagination.value || !!resolvedFooterSummary.value
)

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
  <div ref="tablePanelRef" class="space-y-4">
    <div
      v-if="showStatusFilters"
      class="flex flex-wrap gap-2"
    >
      <UButton
        :variant="statusModel === 'open' ? 'solid' : 'outline'"
        @click="statusModel = 'open'"
      >
        Open
      </UButton>
      <UButton
        :variant="statusModel === 'dismissed' ? 'solid' : 'outline'"
        @click="statusModel = 'dismissed'"
      >
        Dismissed
      </UButton>
      <UButton
        :variant="statusModel === 'all' ? 'solid' : 'outline'"
        @click="statusModel = 'all'"
      >
        All
      </UButton>
    </div>

    <div class="table-surface">
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
        :ui="DATA_TABLE_UI"
      >
        <template #loading>
          <DataTableSkeleton
            :rows="Math.min(pageSize, 5)"
            :layout="skeletonLayout"
            :show-header="false"
          />
        </template>
      </UTable>

      <div
        v-if="showFooter && !showInitialSkeleton"
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

    <p
      v-if="!stableLoading && !displayed.length"
      class="text-sm text-muted text-center py-4"
    >
      No policy matches for this filter.
    </p>
  </div>
</template>
