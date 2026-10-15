<script setup lang="ts">
import { h, resolveComponent, inject } from 'vue'
import { upperFirst } from 'scule'
import { getPaginationRowModel, getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/vue-table'
import type { AccessibilityIssue } from '~/types/sitenook'
import type { AffectedPageSummary } from '~/utils/affectedPages'
import { pageDisplayTitle } from '~/utils/affectedPages'
import { AFFECTED_PAGES_METRICS_SKELETON_COLUMNS, AFFECTED_PAGES_METRICS_WITH_SITE_SKELETON_COLUMNS } from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI_DENSE, dataTableSortableHeader } from '~/utils/dataTableUi'
import { issueRowActionGroups, type DismissReason } from '~/utils/issueActions'
import { issuePageRowKey } from '~/utils/issueRowExit'
import { formatPointsToGain } from '~/composables/useAccessibility'
import { issuesTableScrollKey } from '~/utils/issuesTableScroll'
import { ISSUES_METRIC_COL } from '~/utils/issuesMetricCols'
import {
  issueTargetCategory,
  issueTargetCategoryDescription,
  issueTargetCategoryLabel,
  issueWcagLevelDisplay,
  issueWcagScDisplay
} from '~/utils/issueLabels'

const props = withDefaults(defineProps<{
  pages: AffectedPageSummary[]
  /** Parent issue. Expanded columns inherit Type, WCAG, role, element, severity. */
  parentIssue?: AccessibilityIssue | null
  /** Same visibility map as the parent IssuesTable so columns stay aligned. */
  columnVisibility?: Record<string, boolean>
  rescanningUrl?: string | null
  loading?: boolean
  readOnly?: boolean
  pageSize?: number
  rulePointsToGain?: number
  ruleOccurrences?: number
  ruleId?: string
  siteId?: string
  siteName?: string
  showSiteColumn?: boolean
  showResolvedStatus?: boolean
  wcagLevel?: AccessibilityIssue['wcag_level']
  impact?: AccessibilityIssue['impact']
  removingKeys?: Set<string> | string[]
}>(), {
  parentIssue: null,
  columnVisibility: undefined,
  loading: false,
  readOnly: false,
  pageSize: 10,
  rulePointsToGain: 0,
  ruleOccurrences: 0,
  ruleId: '',
  siteId: '',
  siteName: '',
  showSiteColumn: false,
  showResolvedStatus: false,
  wcagLevel: 'AA',
  impact: 'moderate',
  removingKeys: undefined
})

const emit = defineEmits<{
  rescan: [url: string]
  dismiss: [pageUrl: string, reason: DismissReason, issueIds?: string[]]
  markFixed: [pageUrl: string, issueIds?: string[]]
  select: [page: AffectedPageSummary]
}>()

const UDropdownMenu = resolveComponent('UDropdownMenu')
const UButton = resolveComponent('UButton')

const pagination = ref({ pageIndex: 0, pageSize: props.pageSize })
const sorting = ref<SortingState>([{ id: 'occurrences', desc: true }])

const AFFECTED_TABLE_UI = {
  ...DATA_TABLE_UI_DENSE,
  root: 'relative !overflow-visible',
  base: 'table-fixed border-collapse !min-w-0 !w-auto !overflow-visible',
  // Avoid extra thead border. It shifts metrics rows down vs the frozen rail.
  thead: '',
  tbody: '',
  tr: ''
}

function sortableHeader(
  column: Column<AffectedPageSummary, unknown>,
  label: string,
  align: 'left' | 'right' | 'center' = 'left'
) {
  return dataTableSortableHeader(column, label, align)
}

function pagePointsToGain(page: AffectedPageSummary): number {
  if (!props.rulePointsToGain || !props.ruleOccurrences) return 0
  const ratio = page.occurrences / Math.max(1, props.ruleOccurrences)
  return Math.max(0, props.rulePointsToGain * ratio)
}

function severityLabel(impact: AccessibilityIssue['impact']): 'Critical' | 'Moderate' | 'Minor' {
  if (impact === 'critical' || impact === 'serious') return 'Critical'
  if (impact === 'moderate') return 'Moderate'
  return 'Minor'
}

function severityColor(impact: AccessibilityIssue['impact']): 'error' | 'warning' | 'info' {
  const label = severityLabel(impact)
  if (label === 'Critical') return 'error'
  if (label === 'Moderate') return 'warning'
  return 'info'
}

function isColumnVisible(id: string): boolean {
  const vis = props.columnVisibility
  if (!vis || !(id in vis)) return true
  return vis[id] !== false
}

const inheritedIssue = computed((): Pick<
  AccessibilityIssue,
  'rule_id' | 'wcag_level' | 'wcag_sc' | 'element_type' | 'responsible_role' | 'impact'
> => {
  if (props.parentIssue) return props.parentIssue
  return {
    rule_id: props.ruleId,
    wcag_level: props.wcagLevel,
    impact: props.impact
  }
})

function renderConformanceDash(title: string) {
  return h('span', {
    class: 'text-sm text-muted',
    title
  }, '—')
}

function isRemovingPage(page: AffectedPageSummary): boolean {
  const keys = props.removingKeys
  if (!keys || !props.ruleId) return false
  const key = issuePageRowKey(props.ruleId, page.url, props.siteId || undefined)
  if (keys instanceof Set) return keys.has(key)
  return keys.includes(key)
}

const tableMeta = computed(() => ({
  class: {
    tr: (row: { original: AffectedPageSummary }) =>
      isRemovingPage(row.original) ? 'issue-row--exiting' : ''
  }
}))

/** Metrics only. Title lives in the sticky freeze rail. Order matches IssuesTable. */
const columns = computed((): TableColumn<AffectedPageSummary>[] => {
  const cols: TableColumn<AffectedPageSummary>[] = []
  const issue = inheritedIssue.value

  if (props.showSiteColumn && isColumnVisible('site')) {
    cols.push({
      id: 'site',
      accessorFn: () => props.siteName ?? '',
      header: ({ column }) => sortableHeader(column, 'Site'),
      meta: { class: { th: ISSUES_METRIC_COL.site, td: ISSUES_METRIC_COL.site } },
      cell: () => h('span', {
        class: 'text-sm block truncate w-full',
        title: props.siteName || '—'
      }, props.siteName || '—')
    })
  }

  if (isColumnVisible('target_category')) {
    const category = issueTargetCategory(issue)
    cols.push({
      id: 'target_category',
      accessorFn: () => issueTargetCategoryLabel(category),
      enableSorting: false,
      header: ({ column }) => sortableHeader(column, 'Type', 'center'),
      meta: { class: { th: ISSUES_METRIC_COL.target_category, td: ISSUES_METRIC_COL.target_category } },
      cell: () => h('div', { class: 'flex justify-center' }, [
        h('span', {
          class: 'text-xs font-medium px-2 py-0.5 rounded-md border border-default bg-elevated/50',
          title: issueTargetCategoryDescription(category)
        }, issueTargetCategoryLabel(category))
      ])
    })
  }

  if (isColumnVisible('wcag_level')) {
    cols.push({
      id: 'wcag_level',
      accessorFn: () => issueWcagLevelDisplay(issue) ?? '',
      enableSorting: false,
      header: ({ column }) => sortableHeader(column, 'WCAG level', 'center'),
      meta: { class: { th: ISSUES_METRIC_COL.level, td: ISSUES_METRIC_COL.level } },
      cell: () => {
        const level = issueWcagLevelDisplay(issue)
        if (!level) {
          return h('div', { class: 'flex justify-center' }, [
            renderConformanceDash('Not counted toward WCAG level scores')
          ])
        }
        return h('div', { class: 'flex justify-center' }, [
          h('span', { class: 'wcag-chip' }, level)
        ])
      }
    })
  }

  if (isColumnVisible('wcag_sc')) {
    cols.push({
      id: 'wcag_sc',
      accessorFn: () => issueWcagScDisplay(issue) ?? '',
      enableSorting: false,
      header: ({ column }) => sortableHeader(column, 'WCAG SC', 'center'),
      meta: { class: { th: ISSUES_METRIC_COL.wcag_sc, td: ISSUES_METRIC_COL.wcag_sc } },
      cell: () => {
        const sc = issueWcagScDisplay(issue)
        if (!sc) {
          return renderConformanceDash('No WCAG success criterion for this check type')
        }
        return h('span', {
          class: 'text-sm tabular-nums',
          title: sc
        }, sc)
      }
    })
  }

  if (isColumnVisible('responsible_role')) {
    cols.push({
      id: 'responsible_role',
      accessorFn: () => issue.responsible_role ?? '',
      enableSorting: false,
      header: ({ column }) => sortableHeader(column, 'Responsibility', 'center'),
      meta: { class: { th: ISSUES_METRIC_COL.responsible_role, td: ISSUES_METRIC_COL.responsible_role } },
      cell: () => {
        const role = issue.responsible_role
        const label = role ? upperFirst(role.replace(/_/g, ' ')) : '—'
        return h('span', { class: 'text-sm capitalize', title: label }, label)
      }
    })
  }

  if (isColumnVisible('element_type')) {
    cols.push({
      id: 'element_type',
      accessorFn: () => issue.element_type ?? '',
      enableSorting: false,
      header: ({ column }) => sortableHeader(column, 'Element type', 'center'),
      meta: { class: { th: ISSUES_METRIC_COL.element_type, td: ISSUES_METRIC_COL.element_type } },
      cell: () => {
        const type = issue.element_type
        const label = type ? upperFirst(type.replace(/_/g, ' ')) : '—'
        return h('span', { class: 'text-sm capitalize', title: label }, label)
      }
    })
  }

  if (isColumnVisible('impact')) {
    cols.push({
      id: 'impact',
      accessorFn: () => props.impact,
      enableSorting: false,
      header: ({ column }) => sortableHeader(column, 'Severity', 'center'),
      meta: { class: { th: ISSUES_METRIC_COL.severity, td: ISSUES_METRIC_COL.severity } },
      cell: () => {
        const color = severityColor(props.impact)
        return h('div', { class: 'flex justify-center' }, [
          h('span', {
            class: `text-sm ${color === 'error' ? 'text-error' : color === 'warning' ? 'text-warning' : 'text-info'}`
          }, severityLabel(props.impact))
        ])
      }
    })
  }

  if (isColumnVisible('pages')) {
    cols.push({
      id: 'pages',
      accessorFn: () => 1,
      enableSorting: false,
      header: ({ column }) => sortableHeader(column, 'Pages', 'center'),
      meta: { class: { th: ISSUES_METRIC_COL.pages, td: ISSUES_METRIC_COL.pages } },
      cell: () => '1'
    })
  }

  if (isColumnVisible('occurrences')) {
    cols.push({
      id: 'occurrences',
      accessorKey: 'occurrences',
      header: ({ column }) => sortableHeader(column, 'Occurrences', 'center'),
      meta: { class: { th: ISSUES_METRIC_COL.occurrences, td: ISSUES_METRIC_COL.occurrences } },
      cell: ({ row }) => String(row.original.occurrences)
    })
  }

  if (props.showResolvedStatus) {
    if (isColumnVisible('resolution')) {
      cols.push({
        id: 'resolution',
        accessorFn: () => 'open',
        enableSorting: false,
        header: ({ column }) => sortableHeader(column, 'Status', 'center'),
        meta: { class: { th: ISSUES_METRIC_COL.status, td: ISSUES_METRIC_COL.status } },
        cell: () => h('div', { class: 'flex justify-center' }, [
          h('span', { class: 'text-sm text-muted' }, '—')
        ])
      })
    }
  } else if (isColumnVisible('pointsToGain')) {
    cols.push({
      id: 'pointsToGain',
      accessorFn: row => pagePointsToGain(row),
      header: ({ column }) => sortableHeader(column, 'Points to gain', 'center'),
      meta: {
        class: {
          th: ISSUES_METRIC_COL.points,
          td: ISSUES_METRIC_COL.points
        }
      },
      cell: ({ row }) => {
        const points = pagePointsToGain(row.original)
        return h('div', { class: 'flex justify-center' }, [
          h('span', {
            class: points > 0 ? 'text-sm text-default' : 'text-sm text-muted'
          }, formatPointsToGain(points))
        ])
      }
    })
  }

  if (!props.readOnly) {
    cols.push({
      id: 'actions',
      header: '',
      enableSorting: false,
      enableHiding: false,
      meta: { class: { th: ISSUES_METRIC_COL.actions, td: ISSUES_METRIC_COL.actions } },
      cell: ({ row }) => h(UDropdownMenu, {
        content: { align: 'end' },
        items: issueRowActionGroups({
          onViewDetails: () => emit('select', row.original),
          onRescan: () => emit('rescan', row.original.url),
          onMarkFixed: () => emit('markFixed', row.original.url, row.original.issueIds),
          onDismiss: reason => emit('dismiss', row.original.url, reason, row.original.issueIds),
          rescanLabel: 'Rescan page'
        }),
        'aria-label': `Actions for ${pageDisplayTitle(row.original)}`
      }, () => h(UButton, {
        icon: 'i-lucide-ellipsis-vertical',
        color: 'neutral',
        variant: 'ghost',
        square: true,
        'aria-label': `Actions for ${pageDisplayTitle(row.original)}`,
        onClick: (event: Event) => event.stopPropagation()
      }))
    })
  }

  return cols
})

const sortedPages = computed(() => {
  const list = [...props.pages]
  const sort = sorting.value[0]
  if (!sort) return list

  const dir = sort.desc ? -1 : 1
  list.sort((a, b) => {
    if (sort.id === 'page') {
      return pageDisplayTitle(a).localeCompare(pageDisplayTitle(b)) * dir
    }
    if (sort.id === 'occurrences') {
      return (a.occurrences - b.occurrences) * dir
    }
    if (sort.id === 'pointsToGain') {
      return (pagePointsToGain(a) - pagePointsToGain(b)) * dir
    }
    return 0
  })
  return list
})

const pagedPages = computed(() => {
  const start = pagination.value.pageIndex * pagination.value.pageSize
  return sortedPages.value.slice(start, start + pagination.value.pageSize)
})

const titleSort = computed(() => {
  const sort = sorting.value.find(s => s.id === 'page')
  if (!sort) return false as const
  return sort.desc ? 'desc' as const : 'asc' as const
})

function toggleTitleSort() {
  const current = sorting.value.find(s => s.id === 'page')
  if (!current) {
    sorting.value = [{ id: 'page', desc: false }]
    return
  }
  if (!current.desc) {
    sorting.value = [{ id: 'page', desc: true }]
    return
  }
  sorting.value = [{ id: 'occurrences', desc: true }]
}

const table = useTemplateRef<{ tableApi?: {
  getState: () => { pagination: { pageIndex: number } }
  setPageIndex: (i: number) => void
} }>('table')

const showPagination = computed(
  () => !props.loading && props.pages.length > pagination.value.pageSize
)

const skeletonRowCount = computed(() => Math.min(props.pageSize, 5))

const metricsSkeletonLayout = computed(() =>
  props.showSiteColumn
    ? AFFECTED_PAGES_METRICS_WITH_SITE_SKELETON_COLUMNS
    : AFFECTED_PAGES_METRICS_SKELETON_COLUMNS
)

/**
 * Sub-table spans the parent colspan width and shares the parent horizontal
 * scroller. Only the Title rail sticks; metrics scroll with the main table.
 */
const parentScrollRef = inject(issuesTableScrollKey, null)
const rootRef = useTemplateRef<HTMLElement>('rootRef')
let parentResizeObserver: ResizeObserver | undefined
let boundParent: HTMLElement | null = null

function getParentScroller(): HTMLElement | null {
  return parentScrollRef?.value
    ?? rootRef.value?.closest('.issues-table-scroll') as HTMLElement | null
    ?? null
}

function syncStickyChrome() {
  const parent = getParentScroller()
  const width = Math.max(280, parent?.clientWidth || 800)
  if (!rootRef.value) return
  rootRef.value.style.setProperty('--issues-affected-sticky-bar-width', `${width}px`)
}

function bindParentScroller(el: HTMLElement | null) {
  if (boundParent === el) return
  if (boundParent) {
    parentResizeObserver?.unobserve(boundParent)
  }
  boundParent = el
  if (!el) return
  if (typeof ResizeObserver !== 'undefined') {
    if (!parentResizeObserver) {
      parentResizeObserver = new ResizeObserver(() => syncStickyChrome())
    }
    parentResizeObserver.observe(el)
  }
  syncStickyChrome()
}

onMounted(() => {
  if (!import.meta.client) return
  window.addEventListener('resize', syncStickyChrome, { passive: true })
  nextTick(() => {
    bindParentScroller(getParentScroller())
    requestAnimationFrame(() => bindParentScroller(getParentScroller()))
  })
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('resize', syncStickyChrome)
  bindParentScroller(null)
  parentResizeObserver?.disconnect()
  parentResizeObserver = undefined
})

watch(
  () => parentScrollRef?.value,
  el => bindParentScroller(el ?? null)
)
</script>

<template>
  <div
    ref="rootRef"
    class="issue-affected-pages"
  >
    <div class="issue-affected-pages-frame">
      <h3 class="issue-affected-pages-heading text-xs font-medium text-muted">
        Pages with this issue
      </h3>

      <div class="issue-affected-pages-split">
        <div class="issue-affected-pages-frozen">
          <div class="issue-affected-pages-frozen-th">
            <USkeleton
              v-if="loading"
              class="h-3 w-12 rounded-md !bg-elevated/30"
            />
            <UButton
              v-else
              color="neutral"
              variant="ghost"
              size="xs"
              label="Title"
              :icon="titleSort === 'asc'
                ? 'i-lucide-arrow-up-narrow-wide'
                : titleSort === 'desc'
                  ? 'i-lucide-arrow-down-wide-narrow'
                  : 'i-lucide-arrow-up-down'"
              class="-ms-2"
              :ui="{
                base: 'font-medium',
                leadingIcon: 'size-3.5'
              }"
              @click="toggleTitleSort"
            />
          </div>
          <template v-if="loading">
            <div
              v-for="row in skeletonRowCount"
              :key="`skel-title-${row}`"
              class="issue-affected-pages-frozen-td"
            >
              <div class="min-w-0 max-w-full space-y-1.5 py-0.5">
                <USkeleton class="h-3.5 w-3/5 max-w-xs rounded-md !bg-elevated/30" />
                <USkeleton class="h-3 w-full max-w-md rounded-md !bg-elevated/30" />
              </div>
            </div>
          </template>
          <template v-else>
            <div
              v-for="page in pagedPages"
              :key="page.url"
              class="issue-affected-pages-frozen-td"
              :class="{ 'issue-row--exiting': isRemovingPage(page) }"
            >
              <div
                class="min-w-0 max-w-full space-y-0.5 cursor-pointer rounded-md -mx-1 px-1 hover:bg-elevated/50"
                role="button"
                tabindex="0"
                @click="emit('select', page)"
                @keydown.enter.prevent="emit('select', page)"
                @keydown.space.prevent="emit('select', page)"
              >
                <span
                  class="text-sm font-medium text-primary truncate block"
                  :title="pageDisplayTitle(page)"
                >{{ pageDisplayTitle(page) }}</span>
                <p
                  class="text-xs text-muted truncate"
                  :title="page.url"
                >
                  {{ page.url }}
                </p>
              </div>
            </div>
          </template>
        </div>

        <div class="issue-affected-pages-metrics">
          <DataTableSkeleton
            v-if="loading"
            :rows="skeletonRowCount"
            :layout="metricsSkeletonLayout"
            :show-header="true"
            dense
          />
          <UTable
            v-else
            ref="table"
            v-model:pagination="pagination"
            v-model:sorting="sorting"
            :data="sortedPages"
            :columns="columns"
            :meta="tableMeta"
            :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
            :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
            :ui="AFFECTED_TABLE_UI"
            :empty-state="{
              icon: 'i-lucide-file-x',
              label: 'No pages on the latest scan',
              description: 'This rule has no open issues on the current crawl.'
            }"
          />
        </div>
        <div
          class="issue-affected-pages-tail"
          aria-hidden="true"
        />
      </div>

      <div
        v-if="showPagination"
        class="issue-affected-pages-pagination"
      >
        <UPagination
          :page="(table?.tableApi?.getState().pagination.pageIndex ?? 0) + 1"
          :items-per-page="pagination.pageSize"
          :total="pages.length"
          @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.issue-affected-pages {
  /* Full colspan width. Shares the parent .issues-table-scroll. */
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: none;
  /* Must stay visible so Title can stick to the parent scroller. */
  overflow: visible;
  padding: 0;
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
}

.issue-affected-pages-frame {
  position: relative;
  width: max-content;
  min-width: 100%;
  border: none;
  border-radius: 0;
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
}

.issue-affected-pages-heading {
  position: sticky;
  left: 0;
  z-index: 4;
  box-sizing: border-box;
  width: var(--issues-affected-sticky-bar-width, 100%);
  max-width: var(--issues-affected-sticky-bar-width, 100%);
  margin: 0;
  padding: 0.5rem 1rem 0.35rem calc(var(--issues-expand-col-width, 2.75rem) + 1rem);
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
}

.issue-affected-pages-split {
  display: flex;
  align-items: stretch;
  width: max-content;
  min-width: 100%;
}

.issue-affected-pages-frozen {
  position: sticky;
  left: 0;
  z-index: 3;
  /* Prefer the measured rail (left edge of main Site column). */
  flex: 0 0 var(--issues-frozen-rail-width, 30.75rem);
  width: var(--issues-frozen-rail-width, 30.75rem);
  min-width: var(--issues-frozen-rail-width, 30.75rem);
  max-width: var(--issues-frozen-rail-width, 30.75rem);
  flex-shrink: 0;
  box-sizing: border-box;
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
  border-right: 1px solid color-mix(in srgb, var(--ui-border) 92%, transparent 8%);
  box-shadow: 6px 0 10px -8px color-mix(in srgb, #000 22%, transparent 78%);
}

.issue-affected-pages-frozen-th,
.issue-affected-pages-frozen-td {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0.35rem 1rem 0.35rem calc(var(--issues-expand-col-width, 2.75rem) + 1rem);
  overflow: hidden;
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.issue-affected-pages-frozen-th {
  height: var(--issues-affected-header-height, 3.5rem);
  min-height: var(--issues-affected-header-height, 3.5rem);
  max-height: var(--issues-affected-header-height, 3.5rem);
  border-top: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.issue-affected-pages-frozen-td {
  height: var(--issues-affected-row-height, 3.25rem);
  min-height: var(--issues-affected-row-height, 3.25rem);
  max-height: var(--issues-affected-row-height, 3.25rem);
}

.issue-affected-pages-frozen-td:last-child {
  border-bottom: none;
}

.issue-affected-pages-metrics {
  /* Never shrink metric columns. Horizontal scroll instead. */
  flex: 0 0 auto;
  flex-shrink: 0;
  min-width: max-content;
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
}

/* Match main IssuesTable fixed metric widths. */
.issue-affected-pages-metrics :deep(.issues-metric-col--site) {
  width: 10rem;
  min-width: 10rem;
  max-width: 10rem;
  box-sizing: border-box;
}

.issue-affected-pages-metrics :deep(.issues-metric-col--type) {
  width: 9.5rem;
  min-width: 9.5rem;
  max-width: 9.5rem;
  box-sizing: border-box;
}

.issue-affected-pages-metrics :deep(.issues-metric-col--level),
.issue-affected-pages-metrics :deep(.issues-metric-col--severity) {
  width: 8.5rem;
  min-width: 8.5rem;
  max-width: 8.5rem;
  box-sizing: border-box;
}

.issue-affected-pages-metrics :deep(.issues-metric-col--sc) {
  width: 9rem;
  min-width: 9rem;
  max-width: 9rem;
  box-sizing: border-box;
}

.issue-affected-pages-metrics :deep(.issues-metric-col--role),
.issue-affected-pages-metrics :deep(.issues-metric-col--element) {
  width: 9.5rem;
  min-width: 9.5rem;
  max-width: 9.5rem;
  box-sizing: border-box;
}

.issue-affected-pages-metrics :deep(.issues-metric-col--pages) {
  width: 6.5rem;
  min-width: 6.5rem;
  max-width: 6.5rem;
  box-sizing: border-box;
}

.issue-affected-pages-metrics :deep(.issues-metric-col--occurrences) {
  width: 9rem;
  min-width: 9rem;
  max-width: 9rem;
  box-sizing: border-box;
}

.issue-affected-pages-metrics :deep(.issues-metric-col--points),
.issue-affected-pages-metrics :deep(.issues-metric-col--status) {
  width: 9.5rem;
  min-width: 9.5rem;
  max-width: 9.5rem;
  box-sizing: border-box;
}

.issue-affected-pages-metrics :deep(.issues-metric-col--actions) {
  width: 3.25rem;
  min-width: 3.25rem;
  max-width: 3.25rem;
  box-sizing: border-box;
}

/* Fill any leftover space to the right edge without crushing columns. */
.issue-affected-pages-tail {
  flex: 1 1 auto;
  min-width: 0;
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
}

.issue-affected-pages-metrics :deep(table) {
  table-layout: fixed !important;
  width: max-content !important;
  min-width: 0 !important;
  border-collapse: separate;
  border-spacing: 0;
}

.issue-affected-pages-metrics :deep([data-slot='root']) {
  overflow: visible !important;
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
}

.issue-affected-pages-metrics :deep(thead th),
.issue-affected-pages-metrics :deep(tbody td) {
  box-sizing: border-box;
  padding: 0.35rem 1rem !important;
  vertical-align: middle;
  background-color: var(--table-surface-bg, var(--ui-bg-elevated)) !important;
  border-right: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.issue-affected-pages-metrics :deep(thead th) {
  height: var(--issues-affected-header-height, 3.5rem);
  min-height: var(--issues-affected-header-height, 3.5rem);
  max-height: var(--issues-affected-header-height, 3.5rem);
  border-top: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.issue-affected-pages-metrics :deep(tbody td) {
  height: var(--issues-affected-row-height, 3.25rem);
  min-height: var(--issues-affected-row-height, 3.25rem);
  max-height: var(--issues-affected-row-height, 3.25rem);
  overflow: hidden;
}

.issue-affected-pages-metrics :deep(tr > :last-child) {
  border-right: none;
}

.issue-affected-pages-metrics :deep(tbody tr:last-child td) {
  border-bottom: none;
}

/* Match loaded table chrome while skeleton is showing. */
.issue-affected-pages-metrics :deep(.data-table-skeleton) {
  width: max-content;
  min-width: 0;
  border-collapse: separate;
  border-spacing: 0;
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
}

.issue-affected-pages-metrics :deep(.data-table-skeleton thead tr) {
  background-color: transparent;
}

.issue-affected-pages-metrics :deep(.data-table-skeleton th),
.issue-affected-pages-metrics :deep(.data-table-skeleton td) {
  box-sizing: border-box;
  padding: 0.35rem 1rem !important;
  vertical-align: middle;
  background-color: var(--table-surface-bg, var(--ui-bg-elevated)) !important;
  border-right: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.issue-affected-pages-metrics :deep(.data-table-skeleton th) {
  height: var(--issues-affected-header-height, 3.5rem);
  min-height: var(--issues-affected-header-height, 3.5rem);
  max-height: var(--issues-affected-header-height, 3.5rem);
  border-top: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.issue-affected-pages-metrics :deep(.data-table-skeleton td) {
  height: var(--issues-affected-row-height, 3.25rem);
  min-height: var(--issues-affected-row-height, 3.25rem);
  max-height: var(--issues-affected-row-height, 3.25rem);
  overflow: hidden;
}

.issue-affected-pages-metrics :deep(.data-table-skeleton tr > :last-child) {
  border-right: none;
}

.issue-affected-pages-metrics :deep(.data-table-skeleton tbody tr:last-child td) {
  border-bottom: none;
}

.issue-affected-pages-metrics :deep(.data-table-skeleton tbody) {
  border: none;
}

.issue-affected-pages-metrics :deep(.data-table-skeleton.divide-y),
.issue-affected-pages-metrics :deep(.data-table-skeleton .divide-y) {
  border: none;
}

.issue-affected-pages-pagination {
  position: sticky;
  left: 0;
  z-index: 5;
  box-sizing: border-box;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  width: var(--issues-affected-sticky-bar-width, 100%);
  max-width: var(--issues-affected-sticky-bar-width, 100%);
  border-top: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
  padding: 0.5rem 1rem 0.5rem calc(var(--issues-expand-col-width, 2.75rem) + 1rem);
  background-color: var(--table-surface-bg, var(--ui-bg-elevated));
}

.issue-affected-pages-pagination :deep(nav),
.issue-affected-pages-pagination :deep([data-slot='root']) {
  margin-inline: 0 !important;
  margin-left: 0 !important;
  margin-right: auto !important;
  justify-content: flex-start !important;
}

.issue-affected-pages :deep(tr.issue-row--exiting),
.issue-affected-pages-frozen-td.issue-row--exiting {
  animation: issue-row-exit 280ms ease forwards;
  pointer-events: none;
}

@keyframes issue-row-exit {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(24px);
  }
}

@media (max-width: 1023px) {
  .issue-affected-pages-heading,
  .issue-affected-pages-pagination {
    position: static;
    width: 100%;
    max-width: none;
  }

  /* Unfreeze only. Keep Title rail width locked to main Issue column via CSS vars. */
  .issue-affected-pages-frozen {
    position: static;
    box-shadow: none;
  }
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
