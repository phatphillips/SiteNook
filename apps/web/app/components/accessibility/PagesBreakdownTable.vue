<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { upperFirst } from 'scule'
import { getExpandedRowModel, getPaginationRowModel, getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Row, SortingState } from '@tanstack/vue-table'
import type { AccessibilityIssue } from '~/types/sitenook'
import { formatIssueSeverity, parsePageUrl } from '~/utils/issueExplanation'
import { normalizePageUrl, preferPageUrlDisplay } from '~/utils/pageUrl'
import { issueRowActionGroups } from '~/utils/issueActions'
import { PAGES_BREAKDOWN_TABLE_SKELETON_COLUMNS } from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI, dataTableSortableHeader } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'

const props = withDefaults(defineProps<{
  issues: AccessibilityIssue[]
  siteId: string
  hideToolbar?: boolean
  loading?: boolean
  /** Shown in the table footer (e.g. filter summary). */
  footerSummary?: string
}>(), {
  hideToolbar: false,
  loading: false
})

const globalFilter = defineModel<string>('search', { default: '' })

const emit = defineEmits<{
  openIssue: [AccessibilityIssue]
  rescan: [pageUrl: string]
  markFixed: [pageUrl: string]
  dismiss: [pageUrl: string, reason: string]
}>()

const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const table = useTemplateRef<{ tableApi?: { getAllColumns: () => Array<{ id: string, getCanHide: () => boolean, getIsVisible: () => boolean }>, getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } | undefined, getFilteredRowModel: () => { rows: unknown[] }, getState: () => { pagination: { pageIndex: number } }, setPageIndex: (i: number) => void } }>('table')
const tablePanelRef = useTemplateRef<HTMLElement>('tablePanelRef')

const stableLoading = useStableLoading(toRef(() => props.loading))
const pageSize = 20
const pagination = ref({ pageIndex: 0, pageSize })
const expanded = ref<Record<string, boolean>>({})
const sorting = ref<SortingState>([{ id: 'issues', desc: true }])
const columnVisibility = ref<Record<string, boolean>>({})

interface PageRow {
  url: string
  title: string
  a: number
  aa: number
  aaa: number
  issues: AccessibilityIssue[]
}

const COLUMN_LABELS: Record<string, string> = {
  expand: 'Expand',
  title: 'Title',
  url: 'Page URL',
  a: 'A',
  aa: 'AA',
  aaa: 'AAA',
  issues: 'Issues',
  actions: 'Actions'
}

const PAGES_TABLE_UI = {
  ...DATA_TABLE_UI,
  tr: 'data-[expanded=true]:bg-elevated/50'
}

function uniqueIssuesForPage(issues: AccessibilityIssue[]): AccessibilityIssue[] {
  const byRule = new Map<string, AccessibilityIssue>()
  for (const issue of issues) {
    if (!byRule.has(issue.rule_id)) byRule.set(issue.rule_id, issue)
  }
  return [...byRule.values()]
}

const rows = computed<PageRow[]>(() => {
  const map = new Map<string, PageRow>()
  for (const issue of props.issues.filter(i => i.status !== 'dismissed')) {
    const rawUrl = issue.expand?.page?.url
    if (!rawUrl) continue
    const key = normalizePageUrl(rawUrl)
    const row = map.get(key) ?? { url: rawUrl, title: issue.expand?.page?.title || '', a: 0, aa: 0, aaa: 0, issues: [] }
    row.url = preferPageUrlDisplay(row.url, rawUrl)
    if (!row.title && issue.expand?.page?.title) row.title = issue.expand.page.title
    row.issues.push(issue)
    map.set(key, row)
  }
  for (const row of map.values()) {
    const unique = uniqueIssuesForPage(row.issues)
    row.issues = unique
    row.a = unique.filter(i => i.wcag_level === 'A').length
    row.aa = unique.filter(i => i.wcag_level === 'AA').length
    row.aaa = unique.filter(i => i.wcag_level === 'AAA').length
  }
  return [...map.values()]
})

function total(row: PageRow): number {
  return row.a + row.aa + row.aaa
}

function rowActions(row: Row<PageRow>) {
  const pageUrl = row.original.url
  const firstIssue = uniqueIssuesForPage(row.original.issues)[0]
  return issueRowActionGroups({
    onViewDetails: () => {
      if (firstIssue) emit('openIssue', firstIssue)
    },
    onRescan: () => emit('rescan', pageUrl),
    onMarkFixed: () => emit('markFixed', pageUrl),
    onDismiss: reason => emit('dismiss', pageUrl, reason)
  })
}

const columns: TableColumn<PageRow>[] = [
  {
    id: 'expand',
    enableSorting: false,
    enableHiding: false,
    meta: { class: { th: 'w-11 max-w-[2.75rem] p-0 px-1', td: 'w-11 max-w-[2.75rem] p-0 px-1' } },
    cell: ({ row }) => {
      if (total(row.original) === 0) return null
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        icon: 'i-lucide-chevron-down',
        square: true,
        'aria-label': 'Expand page issues',
        ui: {
          leadingIcon: ['transition-transform', row.getIsExpanded() ? 'duration-200 rotate-180' : '']
        },
        onClick: () => row.toggleExpanded()
      })
    }
  },
  {
    accessorKey: 'title',
    enableHiding: false,
    header: ({ column }) => dataTableSortableHeader(column, 'Title'),
    cell: ({ row }) => h('span', {
      class: 'text-sm text-default block truncate max-w-xs',
      title: row.original.title
    }, row.original.title || '—')
  },
  {
    accessorKey: 'url',
    header: ({ column }) => dataTableSortableHeader(column, 'Page URL'),
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
    id: 'a',
    accessorKey: 'a',
    header: ({ column }) => dataTableSortableHeader(column, 'A', 'center'),
    meta: { class: { th: 'text-center', td: 'text-center tabular-nums' } },
    cell: ({ row }) => row.original.a
  },
  {
    id: 'aa',
    accessorKey: 'aa',
    header: ({ column }) => dataTableSortableHeader(column, 'AA', 'center'),
    meta: { class: { th: 'text-center', td: 'text-center tabular-nums' } },
    cell: ({ row }) => row.original.aa
  },
  {
    id: 'aaa',
    accessorKey: 'aaa',
    header: ({ column }) => dataTableSortableHeader(column, 'AAA', 'center'),
    meta: { class: { th: 'text-center', td: 'text-center tabular-nums' } },
    cell: ({ row }) => row.original.aaa
  },
  {
    id: 'issues',
    accessorFn: row => total(row),
    header: ({ column }) => dataTableSortableHeader(column, 'Issues', 'center'),
    meta: { class: { th: 'text-center', td: 'text-center tabular-nums' } },
    cell: ({ row }) => total(row.original)
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) => h(UDropdownMenu, {
      content: { align: 'end' },
      items: rowActions(row),
      'aria-label': 'Page actions'
    }, () => h(UButton, {
      icon: 'i-lucide-ellipsis-vertical',
      color: 'neutral',
      variant: 'ghost',
      'aria-label': 'Page actions'
    }))
  }
]

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

defineExpose({
  get columnMenuItems() {
    return columnMenuItems.value
  },
  getColumnVisibility: () => columnVisibility.value
})

const filteredRowCount = computed(
  () => table.value?.tableApi?.getFilteredRowModel().rows.length ?? rows.value.length
)

const showPagination = computed(
  () => filteredRowCount.value > pagination.value.pageSize
)

const showTableFooter = computed(
  () => !!props.footerSummary || showPagination.value
)

const showInitialSkeleton = computed(
  () => stableLoading.value && !rows.value.length
)

function onPaginationChange(page: number) {
  table.value?.tableApi?.setPageIndex(page - 1)
  scrollDataTableIntoView(tablePanelRef.value)
}
</script>

<template>
  <div class="pages-table-panel space-y-4">
    <div
      ref="tablePanelRef"
      class="table-surface"
    >
      <DataTableSkeleton
        v-if="showInitialSkeleton"
        :rows="pageSize"
        :layout="PAGES_BREAKDOWN_TABLE_SKELETON_COLUMNS"
      />

      <template v-else>
        <UTable
          ref="table"
          v-model:global-filter="globalFilter"
          v-model:pagination="pagination"
          v-model:expanded="expanded"
          v-model:sorting="sorting"
          v-model:column-visibility="columnVisibility"
          :data="rows"
          :columns="columns"
          :loading="stableLoading && !!rows.length"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
          :expanded-options="{ getExpandedRowModel: getExpandedRowModel() }"
          :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
          :ui="PAGES_TABLE_UI"
        >
          <template #loading>
            <DataTableSkeleton
              :rows="Math.min(pageSize, 5)"
              :layout="PAGES_BREAKDOWN_TABLE_SKELETON_COLUMNS"
              :show-header="false"
            />
          </template>
          <template #empty>
            <div class="py-10 text-center text-sm text-muted">
              No page data yet. Run a scan to populate this view.
            </div>
          </template>
          <template #expanded="{ row }">
            <div class="px-4 py-3 space-y-2">
              <p class="text-xs text-muted">
                {{ total(row.original) }} {{ total(row.original) === 1 ? 'issue' : 'issues' }} on this page
              </p>
              <ul class="space-y-1">
                <li
                  v-for="issue in uniqueIssuesForPage(row.original.issues)"
                  :key="issue.rule_id"
                >
                  <button
                    type="button"
                    class="w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-elevated text-sm"
                    @click="emit('openIssue', issue)"
                  >
                    <span class="wcag-chip">{{ issue.wcag_level }}</span>
                    <span class="flex-1 truncate">{{ issue.description }}</span>
                    <span class="text-xs text-muted shrink-0">{{ formatIssueSeverity(issue.impact) }}</span>
                  </button>
                </li>
              </ul>
              <UButton
                v-if="uniqueIssuesForPage(row.original.issues)[0]"
                size="xs"
                variant="outline"
                label="View full details"
                @click="emit('openIssue', uniqueIssuesForPage(row.original.issues)[0]!)"
              />
            </div>
          </template>
        </UTable>

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
            class="ms-auto"
            @update:page="onPaginationChange"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.wcag-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  background: #0f3d28;
  color: #27a16a;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}
</style>
