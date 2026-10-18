<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { upperFirst } from 'scule'
import { getExpandedRowModel, getPaginationRowModel, getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Row, SortingState } from '@tanstack/vue-table'
import type { AccessibilityIssue } from '~/types/sitenook'
import { parsePageUrl } from '~/utils/issueExplanation'
import { normalizePageUrl, preferPageUrlDisplay } from '~/utils/pageUrl'
import { issueRowActionGroups } from '~/utils/issueActions'
import { PAGES_BREAKDOWN_TABLE_SKELETON_COLUMNS } from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI, dataTableSortableHeader } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'
import { ISSUES_EXPAND_COL_REM } from '~/utils/issuesMetricCols'

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
const scrollRef = useTemplateRef<HTMLElement>('scrollRef')

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

const STICKY_COL_1 = 'pages-table-sticky-col pages-table-sticky-col--1'
const STICKY_COL_2 = 'pages-table-sticky-col pages-table-sticky-col--2'
const EXPAND_COL = 'pages-table-expand-col w-11 max-w-[2.75rem] p-0 px-1'
const TITLE_COL = 'pages-table-title-col'
const METRIC = {
  a: 'pages-metric-col pages-metric-col--level text-center tabular-nums whitespace-nowrap',
  aa: 'pages-metric-col pages-metric-col--level text-center tabular-nums whitespace-nowrap',
  aaa: 'pages-metric-col pages-metric-col--level text-center tabular-nums whitespace-nowrap',
  issues: 'pages-metric-col pages-metric-col--issues text-center tabular-nums whitespace-nowrap',
  actions: 'pages-metric-col pages-metric-col--actions text-right'
} as const

const PAGES_TABLE_UI = {
  ...DATA_TABLE_UI,
  root: 'relative w-full',
  base: 'w-full table-fixed border-collapse',
  thead: 'border-b border-default',
  tbody: '',
  th: `${DATA_TABLE_UI.th} whitespace-nowrap overflow-hidden`,
  td: `${DATA_TABLE_UI.td} whitespace-nowrap overflow-hidden`,
  tr: 'data-[expanded=true]:bg-elevated'
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

function severityLabel(impact: AccessibilityIssue['impact']): 'Critical' | 'Moderate' | 'Minor' {
  if (impact === 'critical' || impact === 'serious') return 'Critical'
  if (impact === 'moderate') return 'Moderate'
  return 'Minor'
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
    header: () => '',
    meta: {
      class: {
        th: `${EXPAND_COL} ${STICKY_COL_1}`,
        td: `${EXPAND_COL} ${STICKY_COL_1} text-center`
      }
    },
    cell: ({ row }) => {
      if (total(row.original) === 0) return null
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        icon: 'i-lucide-chevron-down',
        square: true,
        size: 'xs',
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
    meta: {
      class: {
        th: `${STICKY_COL_2} ${TITLE_COL}`,
        td: `${STICKY_COL_2} ${TITLE_COL}`
      }
    },
    cell: ({ row }) => h('div', { class: 'pages-table-title-cell' }, [
      h('p', {
        class: 'text-sm font-medium truncate min-w-0 w-full',
        title: row.original.title || row.original.url
      }, row.original.title || '—')
    ])
  },
  {
    accessorKey: 'url',
    header: ({ column }) => dataTableSortableHeader(column, 'Page URL'),
    meta: {
      class: {
        th: 'pages-table-url-col',
        td: 'pages-table-url-col'
      }
    },
    cell: ({ row }) => {
      const parsed = parsePageUrl(row.original.url)
      return h('div', { class: 'pages-table-url-cell min-w-0' }, [
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
    meta: { class: { th: METRIC.a, td: METRIC.a } },
    cell: ({ row }) => row.original.a
  },
  {
    id: 'aa',
    accessorKey: 'aa',
    header: ({ column }) => dataTableSortableHeader(column, 'AA', 'center'),
    meta: { class: { th: METRIC.aa, td: METRIC.aa } },
    cell: ({ row }) => row.original.aa
  },
  {
    id: 'aaa',
    accessorKey: 'aaa',
    header: ({ column }) => dataTableSortableHeader(column, 'AAA', 'center'),
    meta: { class: { th: METRIC.aaa, td: METRIC.aaa } },
    cell: ({ row }) => row.original.aaa
  },
  {
    id: 'issues',
    accessorFn: row => total(row),
    header: ({ column }) => dataTableSortableHeader(column, 'Issues', 'center'),
    meta: { class: { th: METRIC.issues, td: METRIC.issues } },
    cell: ({ row }) => total(row.original)
  },
  {
    id: 'actions',
    enableSorting: false,
    enableHiding: false,
    meta: { class: { th: METRIC.actions, td: METRIC.actions } },
    cell: ({ row }) => h(UDropdownMenu, {
      content: { align: 'end' },
      items: rowActions(row),
      'aria-label': 'Page actions'
    }, () => h(UButton, {
      icon: 'i-lucide-ellipsis-vertical',
      color: 'neutral',
      variant: 'ghost',
      size: 'xs',
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

const hasRightOverflowShadow = ref(false)
const headerRowHeightPx = ref(0)
let scrollResizeObserver: ResizeObserver | undefined

function remToPx(rem: number): number {
  if (!import.meta.client) return rem * 16
  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  return rem * (Number.isFinite(root) && root > 0 ? root : 16)
}

function syncTitleColumnWidthVar() {
  const panel = tablePanelRef.value
  const scroll = scrollRef.value
  if (!panel || !scroll) return

  const expandTh = scroll.querySelector<HTMLElement>('thead th.pages-table-expand-col')
  const titleTh = scroll.querySelector<HTMLElement>('thead th.pages-table-title-col')
  const expandWidth = Math.round(expandTh?.offsetWidth ?? remToPx(ISSUES_EXPAND_COL_REM))
  const titleWidth = Math.round(titleTh?.offsetWidth ?? remToPx(18))

  panel.style.setProperty('--pages-expand-col-width', `${expandWidth}px`)
  panel.style.setProperty('--pages-title-col-width', `${titleWidth}px`)
}

function updateScrollChrome() {
  const el = scrollRef.value
  if (!el) {
    hasRightOverflowShadow.value = false
    headerRowHeightPx.value = 0
    return
  }
  const tableEl = el.querySelector('table')
  const scrollWidth = Math.max(el.scrollWidth, tableEl?.scrollWidth ?? 0)
  const clientWidth = el.clientWidth
  const remaining = scrollWidth - clientWidth - el.scrollLeft
  hasRightOverflowShadow.value = scrollWidth > clientWidth + 2 && remaining > 2

  const thead = el.querySelector('thead')
  if (thead) {
    headerRowHeightPx.value = Math.ceil(thead.getBoundingClientRect().height)
  }

  syncTitleColumnWidthVar()
}

function onPaginationChange(page: number) {
  table.value?.tableApi?.setPageIndex(page - 1)
  scrollDataTableIntoView(tablePanelRef.value)
}

watch(
  () => [rows.value.length, columnVisibility.value, sorting.value, expanded.value] as const,
  async () => {
    await nextTick()
    updateScrollChrome()
    requestAnimationFrame(() => {
      syncTitleColumnWidthVar()
      requestAnimationFrame(() => syncTitleColumnWidthVar())
    })
  },
  { deep: true }
)

onMounted(() => {
  nextTick(() => updateScrollChrome())
  if (!import.meta.client) return
  window.addEventListener('resize', updateScrollChrome, { passive: true })
  const el = scrollRef.value
  const panel = tablePanelRef.value
  if (typeof ResizeObserver !== 'undefined') {
    scrollResizeObserver = new ResizeObserver(() => updateScrollChrome())
    if (el) scrollResizeObserver.observe(el)
    if (panel) scrollResizeObserver.observe(panel)
    const body = panel?.closest('.dashboard-panel-body')
    if (body) scrollResizeObserver.observe(body)
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('resize', updateScrollChrome)
  scrollResizeObserver?.disconnect()
  scrollResizeObserver = undefined
})
</script>

<template>
  <div
    ref="tablePanelRef"
    class="pages-table-panel w-full max-w-none space-y-4"
  >
    <div class="table-surface pages-table-surface w-full">
      <DataTableSkeleton
        v-if="showInitialSkeleton"
        :rows="pageSize"
        :layout="PAGES_BREAKDOWN_TABLE_SKELETON_COLUMNS"
      />

      <div
        v-else
        class="pages-table-viewport"
      >
        <div
          ref="scrollRef"
          class="pages-table-scroll"
          :class="{ 'pages-table-scroll--overflow-right': hasRightOverflowShadow }"
          @scroll.passive="updateScrollChrome"
        >
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
              <div class="pages-table-expanded-panel">
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
                        <span class="flex-1 truncate font-medium">{{ issue.description }}</span>
                        <span
                          class="issue-sev-tag shrink-0"
                          :class="{
                            'issue-sev-tag--critical': severityLabel(issue.impact) === 'Critical',
                            'issue-sev-tag--moderate': severityLabel(issue.impact) === 'Moderate',
                            'issue-sev-tag--minor': severityLabel(issue.impact) === 'Minor'
                          }"
                        >{{ severityLabel(issue.impact) }}</span>
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
              </div>
            </template>
          </UTable>
        </div>

        <div
          class="pages-table-right-shadow"
          :class="{ 'pages-table-right-shadow--visible': hasRightOverflowShadow }"
          aria-hidden="true"
        />
        <div
          v-show="hasRightOverflowShadow && headerRowHeightPx > 0"
          class="pages-table-header-cap"
          :style="{ height: `${headerRowHeightPx}px` }"
          aria-hidden="true"
        />
      </div>

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
          :page="(table?.tableApi?.getState().pagination.pageIndex ?? 0) + 1"
          :items-per-page="pagination.pageSize"
          :total="filteredRowCount"
          class="ms-auto"
          @update:page="onPaginationChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pages-table-panel {
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.pages-table-surface {
  display: block;
  overflow: hidden;
  width: 100% !important;
  max-width: 100%;
  box-sizing: border-box;
}

.pages-table-viewport {
  position: relative;
  display: block;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
}

.pages-table-scroll {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
}

.pages-table-scroll--overflow-right {
  box-shadow: inset -12px 0 12px -8px color-mix(in srgb, #000 12%, transparent 88%);
}

.pages-table-panel :deep(.pages-table-scroll [data-slot='root']) {
  width: 100%;
}

.pages-table-panel :deep(.pages-table-scroll table) {
  width: 100% !important;
  min-width: max(100%, 64rem);
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
}

.pages-table-panel :deep(.pages-table-scroll th),
.pages-table-panel :deep(.pages-table-scroll td) {
  border-right: none;
  background-color: var(--table-surface-bg, var(--ui-bg));
}

.pages-table-panel :deep(.pages-table-title-col) {
  width: auto;
  min-width: 14rem;
  max-width: none;
  box-sizing: border-box;
}

.pages-table-panel :deep(.pages-table-title-cell) {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.pages-table-panel :deep(.pages-table-url-col) {
  width: 18rem;
  min-width: 14rem;
  max-width: 22rem;
  box-sizing: border-box;
}

.pages-table-panel :deep(.pages-table-url-cell) {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.pages-table-panel :deep(.pages-metric-col--level) {
  width: 5rem;
  min-width: 5rem;
  max-width: 5rem;
  box-sizing: border-box;
}

.pages-table-panel :deep(.pages-metric-col--issues) {
  width: 6.5rem;
  min-width: 6.5rem;
  max-width: 6.5rem;
  box-sizing: border-box;
}

.pages-table-panel :deep(.pages-metric-col--actions) {
  width: 3.25rem;
  min-width: 3.25rem;
  max-width: 3.25rem;
  box-sizing: border-box;
}

.pages-table-panel :deep(.pages-table-scroll tbody td[colspan]) {
  padding-left: 0 !important;
  padding-right: 0 !important;
  overflow: visible !important;
}

.pages-table-expanded-panel {
  padding: 0;
  min-width: 0;
  overflow: visible;
  position: relative;
  background-color: var(--table-surface-bg, var(--ui-bg));
}

.pages-table-panel :deep(.pages-table-scroll thead th) {
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.pages-table-panel :deep(.pages-table-expand-col) {
  width: 2.75rem;
  min-width: 2.75rem;
  max-width: 2.75rem;
  box-shadow: none;
}

.pages-table-panel :deep(.pages-table-viewport thead th.pages-table-expand-col) {
  border-top-left-radius: 0.5rem;
}

.pages-table-panel :deep(.pages-table-scroll tbody td) {
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.pages-table-panel :deep(.pages-table-scroll tbody tr:last-child td) {
  border-bottom: none;
}

.pages-table-panel :deep(thead tr[data-slot='separator']) {
  display: none;
}

.pages-table-panel :deep(.pages-table-sticky-col) {
  position: sticky;
  z-index: 3;
  overflow: visible;
  background-color: var(--table-surface-bg, var(--ui-bg));
}

.pages-table-panel :deep(thead .pages-table-sticky-col) {
  z-index: 5;
  background-color: var(--table-surface-bg, var(--ui-bg));
}

.pages-table-panel :deep(.pages-table-sticky-col--1) {
  left: 0;
  z-index: 3;
  box-shadow: none;
}

.pages-table-panel :deep(thead .pages-table-sticky-col--1) {
  z-index: 5;
}

.pages-table-panel :deep(.pages-table-sticky-col--2) {
  left: var(--pages-expand-col-width, 2.75rem);
  z-index: 4;
  overflow: visible;
  box-shadow: 6px 0 10px -8px color-mix(in srgb, #000 22%, transparent 78%);
}

.pages-table-panel :deep(thead .pages-table-sticky-col--2) {
  z-index: 6;
  overflow: hidden;
}

.pages-table-panel :deep(tr[data-expanded='true'] td:not(.pages-table-sticky-col)) {
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
}

.pages-table-panel :deep(tr[data-expanded='true'] .pages-table-sticky-col) {
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
}

.pages-table-panel :deep(tbody tr:has(.pages-table-expanded-panel) > td) {
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
}

.pages-table-right-shadow {
  pointer-events: none;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1.25rem;
  opacity: 0;
  transition: opacity 120ms ease;
  background: linear-gradient(
    to left,
    color-mix(in srgb, #000 14%, transparent 86%),
    transparent
  );
  z-index: 7;
}

.pages-table-right-shadow--visible {
  opacity: 1;
}

.pages-table-header-cap {
  pointer-events: none;
  position: absolute;
  top: 0;
  right: 0;
  width: 1.25rem;
  z-index: 8;
  background: linear-gradient(
    to left,
    var(--table-surface-bg, var(--ui-bg)) 0%,
    var(--table-surface-bg, var(--ui-bg)) 100%
  );
}

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
