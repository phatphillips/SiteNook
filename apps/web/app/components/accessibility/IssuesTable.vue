<script setup lang="ts">
import { h, resolveComponent, provide } from 'vue'
import { upperFirst } from 'scule'
import { getExpandedRowModel, getPaginationRowModel, getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, Row, SortingState } from '@tanstack/vue-table'
import type { AccessibilityIssue } from '~/types/sitenook'
import { calculateMarginalPointsToGain, calculatePointsToGain, formatPointsToGain } from '~/composables/useAccessibility'
import type { ElementTotals } from '~/utils/siteimproveScore'
import { occurrenceCountForRule, resolvedAtMs } from '~/utils/accessibilityIssues'
import type { AffectedPageSummary } from '~/utils/affectedPages'
import { issueRowActionGroups } from '~/utils/issueActions'
import { issueRowKey } from '~/utils/issueRowExit'
import {
  ISSUES_TABLE_READONLY_SKELETON_COLUMNS,
  ISSUES_TABLE_SKELETON_COLUMNS
} from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'
import { issuesTableScrollKey } from '~/utils/issuesTableScroll'
import {
  ISSUES_EXPAND_COL_REM,
  ISSUES_ISSUE_COL_MIN_REM,
  ISSUES_METRIC_COL
} from '~/utils/issuesMetricCols'
import {
  issueTargetCategory,
  issueTargetCategoryDescription,
  issueTargetCategoryLabel,
  issueWcagLevelDisplay,
  issueWcagScDisplay
} from '~/utils/issueLabels'

const props = withDefaults(defineProps<{
  issues: AccessibilityIssue[]
  /** Open + dismissed issues used to compute score impact (same set as overall score). */
  scoringIssues?: AccessibilityIssue[]
  /** Cached element denominators from the latest scan (accurate live scoring). */
  scoreElementTotals?: ElementTotals
  /** Precomputed points-to-gain per rule (avoids repeated scoring). */
  pointsToGainByRule?: Map<string, number>
  /** Per-rule page/occurrence counts from the issues API summary. */
  ruleStats?: Map<string, { pages: number, occurrences: number }>
  pagesByRule?: Map<string, string[]>
  /** Rich page rows for expanded panel (Issues page). */
  affectedPagesByRule?: Map<string, AffectedPageSummary[]>
  /** Lazy builder for affected pages when full map is not preloaded. */
  getAffectedPagesForRule?: (ruleId: string, siteId?: string) => AffectedPageSummary[]
  loadAffectedPagesForRule?: (ruleId: string, siteId?: string) => Promise<unknown>
  rescanningPageUrl?: string | null
  siteId?: string
  showSiteColumn?: boolean
  readOnly?: boolean
  hideToolbar?: boolean
  /** Show Fixed/Dismissed column instead of points to gain. */
  showResolvedStatus?: boolean
  /** Resolved page: view-details action only. */
  resolvedActions?: boolean
  pageSize?: number
  /** Server-driven pagination (Issues page API). */
  serverPaginated?: boolean
  total?: number
  page?: number
  loading?: boolean
  isAffectedPagesLoading?: (ruleId: string, siteId?: string) => boolean
  /** Shown in the table footer (e.g. filter summary). */
  footerSummary?: string
  /** Right-aligned footer link styled as a button (overview previews). */
  footerLink?: { to: string, label: string }
  /** Section title in table header (overview previews). */
  tableTitle?: string
  /** Initial column visibility (overview: Issue, Severity, Points to gain only). */
  defaultColumnVisibility?: Record<string, boolean>
  /** Row keys currently animating out after dismiss/fix (`siteId:ruleId` or `ruleId`). */
  removingKeys?: Set<string> | string[]
}>(), {
  readOnly: false,
  hideToolbar: false,
  showResolvedStatus: false,
  resolvedActions: false,
  pageSize: 20,
  serverPaginated: false,
  total: 0,
  page: 1,
  loading: false,
  isAffectedPagesLoading: undefined,
  siteId: '',
  showSiteColumn: false,
  removingKeys: undefined
})

const stableLoading = useStableLoading(toRef(() => props.loading))

const emit = defineEmits<{
  open: [AccessibilityIssue]
  rescan: []
  rescanPage: [pageUrl: string, siteId?: string]
  markFixed: [ruleId: string, siteId?: string]
  dismiss: [ruleId: string, reason: string, siteId?: string]
  dismissPage: [ruleId: string, pageUrl: string, reason: string, issueIds?: string[], siteId?: string]
  markPageFixed: [ruleId: string, pageUrl: string, issueIds?: string[], siteId?: string]
  'update:page': [page: number]
}>()

const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const table = useTemplateRef<{ tableApi?: { getAllColumns: () => Array<{ id: string, getCanHide: () => boolean, getIsVisible: () => boolean }>, getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } | undefined, getFilteredRowModel: () => { rows: unknown[] }, getState: () => { pagination: { pageIndex: number } }, setPageIndex: (i: number) => void } }>('table')
const tablePanelRef = useTemplateRef<HTMLElement>('tablePanelRef')
const scrollRef = useTemplateRef<HTMLElement>('scrollRef')

provide(issuesTableScrollKey, scrollRef)

const globalFilter = defineModel<string>('search', { default: '' })
const pagination = ref({ pageIndex: 0, pageSize: props.pageSize })

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
const expanded = ref<Record<string, boolean>>({})
const sorting = ref<SortingState>(
  props.showResolvedStatus
    ? [{ id: 'resolvedAt', desc: true }]
    : [{ id: 'pointsToGain', desc: true }]
)
const columnVisibility = ref<Record<string, boolean>>(
  props.defaultColumnVisibility ? { ...props.defaultColumnVisibility } : {}
)

const showTableHeader = computed(
  () => !!props.tableTitle
)

const IMPACT_SORT: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1
}

const COLUMN_LABELS: Record<string, string> = {
  expand: 'Expand',
  issue: 'Issue',
  target_category: 'Type',
  wcag_level: 'WCAG level',
  wcag_sc: 'WCAG SC',
  responsible_role: 'Responsibility',
  element_type: 'Element type',
  impact: 'Severity',
  pages: 'Pages',
  occurrences: 'Occurrences',
  pointsToGain: 'Points to gain',
  resolvedAt: 'Resolved',
  resolution: 'Status',
  actions: 'Actions'
}

function renderConformanceDash(title: string) {
  return h('span', {
    class: 'text-sm text-muted',
    title
  }, '—')
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

function pageCount(issue: AccessibilityIssue): number {
  const stats = props.ruleStats?.get(issue.rule_id)
  if (stats) return stats.pages
  const rich = affectedPagesForIssue(issue)
  if (rich.length) return rich.length
  return props.pagesByRule?.get(issue.rule_id)?.length ?? 0
}

function occurrenceCount(issue: AccessibilityIssue): number {
  const stats = props.ruleStats?.get(issue.rule_id)
  if (stats) return stats.occurrences
  const rich = affectedPagesForIssue(issue)
  if (rich.length) {
    return rich.reduce((sum, page) => sum + page.occurrences, 0)
  }
  return occurrenceCountForRule(
    props.scoringIssues ?? [],
    issue.rule_id,
    props.showResolvedStatus ? undefined : ['open']
  )
}

const lazyAffectedCache = ref<Map<string, AffectedPageSummary[]>>(new Map())
const pendingAffectedPagesLoad = ref<Set<string>>(new Set())

const ISSUES_TABLE_UI = {
  ...DATA_TABLE_UI,
  root: 'relative w-full',
  // Full-width table; leftover space grows the Issue column so metrics stay right-aligned.
  base: 'w-full table-fixed border-collapse',
  thead: 'border-b border-default',
  tbody: '',
  th: 'p-0 px-4 py-2.5 text-xs font-medium text-muted whitespace-nowrap overflow-hidden',
  td: 'p-0 px-4 py-2.5 align-middle text-sm text-default whitespace-nowrap overflow-hidden',
  tr: 'data-[expanded=true]:bg-elevated/50'
}

watch(
  () => props.issues.map(issue => affectedPagesCacheKey(issue)).sort().join('|'),
  (next, prev) => {
    if (next === prev) return
    const nextKeys = new Set(props.issues.map(issue => affectedPagesCacheKey(issue)))
    const pruned = new Map<string, AffectedPageSummary[]>()
    for (const [key, value] of lazyAffectedCache.value) {
      if (nextKeys.has(key)) pruned.set(key, value)
    }
    lazyAffectedCache.value = pruned
    const pending = new Set<string>()
    for (const key of pendingAffectedPagesLoad.value) {
      if (nextKeys.has(key)) pending.add(key)
    }
    pendingAffectedPagesLoad.value = pending
  }
)

function isRemovingIssue(issue: AccessibilityIssue): boolean {
  const keys = props.removingKeys
  if (!keys) return false
  const key = issueRowKey(issue.rule_id, issueSiteId(issue))
  if (keys instanceof Set) return keys.has(key)
  return keys.includes(key)
}

const tableMeta = computed(() => ({
  class: {
    tr: (row: Row<AccessibilityIssue>) =>
      isRemovingIssue(row.original) ? 'issue-row--exiting' : ''
  }
}))

function issueSiteId(issue: AccessibilityIssue): string | undefined {
  const fromRow = (issue as AccessibilityIssue & { siteId?: string }).siteId
  return fromRow || props.siteId || undefined
}

function affectedPagesCacheKey(issue: AccessibilityIssue): string {
  const siteId = issueSiteId(issue)
  return siteId ? `${siteId}:${issue.rule_id}` : issue.rule_id
}

function affectedPagesForIssue(issue: AccessibilityIssue): AffectedPageSummary[] {
  const fromMap = props.affectedPagesByRule?.get(issue.rule_id)
  if (fromMap?.length) return fromMap
  if (props.getAffectedPagesForRule) {
    const cacheKey = affectedPagesCacheKey(issue)
    const cached = lazyAffectedCache.value.get(cacheKey)
    if (cached?.length) return cached
    const built = props.getAffectedPagesForRule(issue.rule_id, issueSiteId(issue))
    if (built.length) {
      lazyAffectedCache.value.set(cacheKey, built)
    }
    return built
  }
  return []
}

function pointsToGain(issue: AccessibilityIssue): number {
  const precomputed = props.pointsToGainByRule?.get(issue.rule_id)
  if (precomputed != null) return precomputed
  return calculatePointsToGain(
    props.scoringIssues ?? [],
    issue.rule_id,
    props.scoreElementTotals
  )
}

function marginalPointsToGain(issue: AccessibilityIssue): number {
  return calculateMarginalPointsToGain(
    props.scoringIssues ?? [],
    issue.rule_id,
    props.scoreElementTotals
  )
}

function displayPointsToGain(issue: AccessibilityIssue): number {
  const total = pointsToGain(issue)
  if (total > 0) return total

  const marginal = marginalPointsToGain(issue)
  if (marginal > 0) return marginal

  // Keep a non-zero reward label for open issue types with occurrences.
  if (!props.showResolvedStatus && occurrenceCount(issue) > 0) return 0.1
  return 0
}

function endAffectedPagesLoad(issue: AccessibilityIssue) {
  const key = affectedPagesCacheKey(issue)
  if (!pendingAffectedPagesLoad.value.has(key)) return
  const next = new Set(pendingAffectedPagesLoad.value)
  next.delete(key)
  pendingAffectedPagesLoad.value = next
}

function isAffectedPagesLoadingFor(issue: AccessibilityIssue): boolean {
  const key = affectedPagesCacheKey(issue)
  if (pendingAffectedPagesLoad.value.has(key)) return true
  return props.isAffectedPagesLoading?.(issue.rule_id, issueSiteId(issue)) ?? false
}

function openIssueRow(issue: AccessibilityIssue) {
  if (props.readOnly) emit('open', issue)
}

function sortableHeader(
  column: Column<AccessibilityIssue, unknown>,
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

function rowActions(row: Row<AccessibilityIssue>) {
  const ruleId = row.original.rule_id
  if (props.resolvedActions) {
    return [[{
      label: 'View details',
      icon: 'i-lucide-eye',
      onSelect: () => emit('open', row.original)
    }]]
  }
  return issueRowActionGroups({
    onViewDetails: () => emit('open', row.original),
    onRescan: () => emit('rescan'),
    onMarkFixed: () => emit('markFixed', ruleId, issueSiteId(row.original)),
    onDismiss: reason => emit('dismiss', ruleId, reason, issueSiteId(row.original)),
    rescanLabel: 'Rescan page'
  })
}

const STICKY_COL_1 = 'issues-table-sticky-col issues-table-sticky-col--1'
const STICKY_COL_2 = 'issues-table-sticky-col issues-table-sticky-col--2'
const EXPAND_COL = 'issues-table-expand-col w-11 max-w-[2.75rem] p-0 px-1'
const ISSUE_COL = 'issues-table-issue-col'

function ensureAffectedPagesLoaded(issue: AccessibilityIssue) {
  if (affectedPagesForIssue(issue).length) return
  pendingAffectedPagesLoad.value = new Set(pendingAffectedPagesLoad.value)
    .add(affectedPagesCacheKey(issue))

  void props.loadAffectedPagesForRule?.(issue.rule_id, issueSiteId(issue))
    ?.finally(() => endAffectedPagesLoad(issue))
}

function toggleExpandedRow(row: Row<AccessibilityIssue>) {
  if (pageCount(row.original) === 0) return
  const willExpand = !row.getIsExpanded()
  row.toggleExpanded()
  if (willExpand) ensureAffectedPagesLoaded(row.original)
}

const columns = computed((): TableColumn<AccessibilityIssue>[] => {
  const cols: TableColumn<AccessibilityIssue>[] = []

  cols.push({
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
      if (pageCount(row.original) === 0) return null
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        icon: 'i-lucide-chevron-down',
        square: true,
        size: 'xs',
        'aria-label': 'Expand affected pages',
        ui: {
          leadingIcon: ['transition-transform', row.getIsExpanded() ? 'duration-200 rotate-180' : '']
        },
        onClick: () => toggleExpandedRow(row)
      })
    }
  })

  cols.push({
    id: 'issue',
    accessorFn: row => `${row.rule_id} ${row.description}`,
    enableHiding: false,
    header: ({ column }) => sortableHeader(column, 'Issue'),
    meta: {
      class: {
        th: `${STICKY_COL_2} ${ISSUE_COL}`,
        td: `${STICKY_COL_2} ${ISSUE_COL}`
      }
    },
    cell: ({ row }) => h('div', {
      class: ['issues-table-issue-cell', props.readOnly ? 'cursor-pointer' : ''],
      onClick: props.readOnly ? () => openIssueRow(row.original) : undefined
    }, [
      h('p', {
        class: 'text-sm font-medium truncate min-w-0 w-full',
        title: row.original.description
      }, row.original.description),
      h('div', { class: 'flex items-center gap-1.5 mt-0.5 min-w-0 w-full overflow-hidden' }, [
        h('span', {
          class: 'text-[11px] text-muted shrink-0 uppercase tracking-wide'
        }, 'axe'),
        h('code', {
          class: 'text-xs text-muted truncate min-w-0 flex-1 font-mono',
          title: row.original.rule_id
        }, row.original.rule_id)
      ])
    ])
  })

  if (props.showSiteColumn) {
    cols.push({
      id: 'site',
      accessorFn: row => (row as AccessibilityIssue & { siteName?: string }).siteName ?? '',
      header: ({ column }) => sortableHeader(column, 'Site'),
      meta: {
        class: {
          th: ISSUES_METRIC_COL.site,
          td: ISSUES_METRIC_COL.site
        }
      },
      cell: ({ row }) => h('span', {
        class: 'text-sm block truncate w-full',
        title: (row.original as AccessibilityIssue & { siteName?: string }).siteName ?? '—'
      }, (row.original as AccessibilityIssue & { siteName?: string }).siteName ?? '—')
    })
  }

  cols.push({
    id: 'target_category',
    accessorFn: row => issueTargetCategoryLabel(issueTargetCategory(row)),
    header: ({ column }) => sortableHeader(column, 'Type', 'center'),
    meta: {
      class: {
        th: ISSUES_METRIC_COL.target_category,
        td: ISSUES_METRIC_COL.target_category
      }
    },
    cell: ({ row }) => {
      const category = issueTargetCategory(row.original)
      return h('div', { class: 'flex justify-center' }, [
        h('span', {
          class: 'text-xs font-medium px-2 py-0.5 rounded-md border border-default bg-elevated/50',
          title: issueTargetCategoryDescription(category)
        }, issueTargetCategoryLabel(category))
      ])
    }
  })
  cols.push({
    accessorKey: 'wcag_level',
    header: ({ column }) => sortableHeader(column, 'WCAG level', 'center'),
    meta: {
      class: {
        th: ISSUES_METRIC_COL.level,
        td: ISSUES_METRIC_COL.level
      }
    },
    cell: ({ row }) => {
      const level = issueWcagLevelDisplay(row.original)
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
  cols.push({
    accessorKey: 'wcag_sc',
    header: ({ column }) => sortableHeader(column, 'WCAG SC', 'center'),
    meta: {
      class: {
        th: ISSUES_METRIC_COL.wcag_sc,
        td: ISSUES_METRIC_COL.wcag_sc
      }
    },
    cell: ({ row }) => {
      const sc = issueWcagScDisplay(row.original)
      if (!sc) {
        return renderConformanceDash('No WCAG success criterion for this check type')
      }
      return h('span', {
        class: 'text-sm tabular-nums',
        title: sc
      }, sc)
    }
  })
  cols.push({
    accessorKey: 'responsible_role',
    header: ({ column }) => sortableHeader(column, 'Responsibility', 'center'),
    meta: {
      class: {
        th: ISSUES_METRIC_COL.responsible_role,
        td: ISSUES_METRIC_COL.responsible_role
      }
    },
    cell: ({ row }) => {
      const role = row.original.responsible_role
      const label = role ? upperFirst(role.replace(/_/g, ' ')) : '—'
      return h('span', { class: 'text-sm capitalize', title: label }, label)
    }
  })
  cols.push({
    accessorKey: 'element_type',
    header: ({ column }) => sortableHeader(column, 'Element type', 'center'),
    meta: {
      class: {
        th: ISSUES_METRIC_COL.element_type,
        td: ISSUES_METRIC_COL.element_type
      }
    },
    cell: ({ row }) => {
      const type = row.original.element_type
      const label = type ? upperFirst(type.replace(/_/g, ' ')) : '—'
      return h('span', { class: 'text-sm capitalize', title: label }, label)
    }
  })
  cols.push({
    id: 'impact',
    accessorFn: row => IMPACT_SORT[row.impact] ?? 0,
    header: ({ column }) => sortableHeader(column, 'Severity', 'center'),
    meta: { class: { th: ISSUES_METRIC_COL.severity, td: ISSUES_METRIC_COL.severity } },
    cell: ({ row }) => {
      const color = severityColor(row.original.impact)
      return h('div', { class: 'flex justify-center' }, [
        h('span', {
          class: `text-sm ${color === 'error' ? 'text-error' : color === 'warning' ? 'text-warning' : 'text-info'}`
        }, severityLabel(row.original.impact))
      ])
    }
  })
  cols.push({
    id: 'pages',
    accessorFn: row => pageCount(row),
    header: ({ column }) => sortableHeader(column, 'Pages', 'center'),
    meta: { class: { th: ISSUES_METRIC_COL.pages, td: ISSUES_METRIC_COL.pages } },
    cell: ({ row }) => `${pageCount(row.original)}`
  })
  cols.push({
    id: 'occurrences',
    accessorFn: row => occurrenceCount(row),
    header: ({ column }) => sortableHeader(column, 'Occurrences', 'center'),
    meta: { class: { th: ISSUES_METRIC_COL.occurrences, td: ISSUES_METRIC_COL.occurrences } },
    cell: ({ row }) => `${occurrenceCount(row.original)}`
  })

  if (props.showResolvedStatus) {
    cols.push({
      id: 'resolvedAt',
      accessorFn: row => resolvedAtMs(row),
      header: ({ column }) => sortableHeader(column, 'Resolved', 'center'),
      meta: { class: { th: ISSUES_METRIC_COL.status, td: ISSUES_METRIC_COL.status } },
      cell: ({ row }) => {
        const ms = resolvedAtMs(row.original)
        if (!ms) return '—'
        return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      }
    })
    cols.push({
      id: 'resolution',
      accessorFn: row => row.status,
      header: ({ column }) => sortableHeader(column, 'Status', 'center'),
      meta: { class: { th: ISSUES_METRIC_COL.status, td: ISSUES_METRIC_COL.status } },
      cell: ({ row }) => h('div', { class: 'flex justify-center' }, [
        h('span', {
          class: `text-sm ${row.original.status === 'fixed' ? 'text-success' : 'text-muted'}`
        }, row.original.status === 'fixed' ? 'Fixed' : 'Dismissed')
      ])
    })
  } else {
    cols.push({
      id: 'pointsToGain',
      accessorFn: row => displayPointsToGain(row),
      header: ({ column }) => sortableHeader(column, 'Points to gain', 'center'),
      meta: {
        class: {
          th: ISSUES_METRIC_COL.points,
          td: ISSUES_METRIC_COL.points
        }
      },
      cell: ({ row }) => {
        const pts = displayPointsToGain(row.original)
        const marginal = marginalPointsToGain(row.original)
        const label = formatPointsToGain(pts)
        const prominent = pts >= 1
        const marginalLabel = formatPointsToGain(marginal)
        return h('div', { class: 'flex justify-center' }, [
          h('span', {
            class: prominent
              ? 'text-sm font-semibold text-success'
              : pts > 0
                ? 'text-sm'
                : 'text-sm text-muted',
            title: marginal > 0 && marginal !== pts
              ? `${label} if all occurrences of this rule are fixed (${marginalLabel} for one occurrence)`
              : `${label} if all occurrences of this rule are fixed`
          }, label)
        ])
      }
    })
  }

  if (!props.readOnly) {
    cols.push({
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: { class: { th: ISSUES_METRIC_COL.actions, td: ISSUES_METRIC_COL.actions } },
      cell: ({ row }) => h(UDropdownMenu, {
        content: { align: 'end' },
        items: rowActions(row),
        'aria-label': 'Issue actions'
      }, () => h(UButton, {
        icon: 'i-lucide-ellipsis-vertical',
        color: 'neutral',
        variant: 'ghost',
        'aria-label': 'Issue actions'
      }))
    })
  }

  return cols
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

const filteredRowCount = computed(() => {
  if (props.serverPaginated) return props.total
  return table.value?.tableApi?.getFilteredRowModel().rows.length ?? props.issues.length
})

const showPagination = computed(() => {
  const pageSize = props.serverPaginated ? props.pageSize : pagination.value.pageSize
  return filteredRowCount.value > pageSize
})

const showInitialSkeleton = computed(
  () => stableLoading.value && !props.issues.length
)

const issuesSkeletonLayout = computed(() =>
  props.readOnly ? ISSUES_TABLE_READONLY_SKELETON_COLUMNS : ISSUES_TABLE_SKELETON_COLUMNS
)

const tablePaginationOptions = computed(() =>
  props.serverPaginated ? undefined : { getPaginationRowModel: getPaginationRowModel() }
)

const showTableFooter = computed(
  () => !!props.footerSummary || !!props.footerLink || showPagination.value
)

const hasRightOverflowShadow = ref(false)
const headerRowHeightPx = ref(0)
let scrollResizeObserver: ResizeObserver | undefined

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

  syncIssueColumnWidthVar()
}

/**
 * Issue grows to fill leftover width (metrics stay on the right edge).
 * Remeasure so the expanded Title rail lines up with the first metric column.
 */
const ISSUE_COL_MIN_REM = ISSUES_ISSUE_COL_MIN_REM
const EXPAND_COL_REM = ISSUES_EXPAND_COL_REM

function remToPx(rem: number): number {
  if (!import.meta.client) return rem * 16
  const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  return rem * (Number.isFinite(root) && root > 0 ? root : 16)
}

function syncIssueColumnWidthVar() {
  const panel = tablePanelRef.value
  const scroll = scrollRef.value
  if (!panel || !scroll) return

  const table = scroll.querySelector('table')
  table?.querySelector('colgroup[data-issues-cols]')?.remove()

  void scroll.offsetWidth

  const expandTh = scroll.querySelector<HTMLElement>('thead th.issues-table-expand-col')
  const issueTh = scroll.querySelector<HTMLElement>('thead th.issues-table-issue-col')
  const firstMetricTh = scroll.querySelector<HTMLElement>('thead th.issues-metric-col')

  const expandWidth = Math.round(expandTh?.offsetWidth ?? remToPx(EXPAND_COL_REM))
  const issueWidth = Math.round(issueTh?.offsetWidth ?? remToPx(ISSUE_COL_MIN_REM))

  panel.style.setProperty('--issues-expand-col-width', `${expandWidth}px`)
  panel.style.setProperty('--issues-issue-col-width', `${issueWidth}px`)

  let railWidth = expandWidth + issueWidth
  if (expandTh && firstMetricTh) {
    // offsetLeft is scroll-stable (unlike getBoundingClientRect with sticky cols).
    const measured = Math.round(firstMetricTh.offsetLeft - expandTh.offsetLeft)
    if (measured > expandWidth) railWidth = measured
  }

  panel.style.setProperty('--issues-frozen-rail-width', `${railWidth}px`)
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

watch(
  () => [props.issues.length, props.total, props.pageSize, columnVisibility.value, sorting.value, expanded.value] as const,
  async () => {
    await nextTick()
    updateScrollChrome()
    // Nested table mounts after expand. Remeasure until geometry + colgroup settle.
    requestAnimationFrame(() => {
      syncIssueColumnWidthVar()
      requestAnimationFrame(() => {
        syncIssueColumnWidthVar()
        // One more pass after the affected-pages grid paints.
        setTimeout(() => syncIssueColumnWidthVar(), 50)
      })
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

defineExpose({
  get columnMenuItems() {
    return columnMenuItems.value
  },
  getColumnVisibility: () => columnVisibility.value
})
</script>

<template>
  <div ref="tablePanelRef" class="issues-table-panel w-full max-w-none space-y-4">
    <div class="table-surface issues-table-surface w-full">
      <div
        v-if="showTableHeader"
        class="flex items-center justify-between gap-2 border-b border-default px-4 py-3"
      >
        <h2 class="font-semibold text-sm sm:text-base">
          {{ tableTitle }}
        </h2>
        <UDropdownMenu
          :items="columnMenuItems"
          :content="{ align: 'end' }"
        >
          <TableToolbarMenuButton
            label="Columns"
            icon="i-lucide-columns-3"
            aria-label="Toggle column visibility"
          />
        </UDropdownMenu>
      </div>

      <DataTableSkeleton
        v-if="showInitialSkeleton"
        :rows="pageSize"
        :layout="issuesSkeletonLayout"
      />

      <div
        v-else
        class="issues-table-viewport"
        :class="{ 'issues-table-viewport--with-title': showTableHeader }"
      >
        <div
          ref="scrollRef"
          class="issues-table-scroll"
          :class="{ 'issues-table-scroll--overflow-right': hasRightOverflowShadow }"
          @scroll.passive="updateScrollChrome"
        >
          <UTable
            ref="table"
            v-model:global-filter="tableGlobalFilter"
            v-model:pagination="pagination"
            v-model:expanded="expanded"
            v-model:sorting="sorting"
            v-model:column-visibility="columnVisibility"
            :data="issues"
            :columns="columns"
            :meta="tableMeta"
            :loading="stableLoading && !!issues.length"
            :pagination-options="tablePaginationOptions"
            :expanded-options="{ getExpandedRowModel: getExpandedRowModel() }"
            :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
            :ui="ISSUES_TABLE_UI"
          >
            <template #loading>
              <DataTableSkeleton
                :rows="Math.min(pageSize, 5)"
                :layout="issuesSkeletonLayout"
                :show-header="false"
              />
            </template>
            <template #expanded="{ row }">
              <div class="issues-table-expanded-panel">
                <AccessibilityIssueAffectedPagesTable
                  v-if="pageCount(row.original) > 0 && (isAffectedPagesLoadingFor(row.original) || affectedPagesForIssue(row.original).length > 0)"
                  :pages="affectedPagesForIssue(row.original)"
                  :parent-issue="row.original"
                  :column-visibility="columnVisibility"
                  :rule-points-to-gain="displayPointsToGain(row.original)"
                  :rule-occurrences="occurrenceCount(row.original)"
                  :loading="isAffectedPagesLoadingFor(row.original)"
                  :read-only="readOnly"
                  :rescanning-url="rescanningPageUrl"
                  :removing-keys="removingKeys"
                  :rule-id="row.original.rule_id"
                  :site-id="issueSiteId(row.original)"
                  :site-name="(row.original as AccessibilityIssue & { siteName?: string }).siteName ?? ''"
                  :show-site-column="showSiteColumn"
                  :show-resolved-status="showResolvedStatus"
                  :wcag-level="row.original.wcag_level"
                  :impact="row.original.impact"
                  @select="() => emit('open', row.original)"
                  @rescan="(url: string) => emit('rescanPage', url, issueSiteId(row.original))"
                  @dismiss="(url: string, reason: string, issueIds?: string[]) => emit('dismissPage', row.original.rule_id, url, reason, issueIds, issueSiteId(row.original))"
                  @mark-fixed="(url: string, issueIds?: string[]) => emit('markPageFixed', row.original.rule_id, url, issueIds, issueSiteId(row.original))"
                />
                <p
                  v-else
                  class="text-sm text-muted"
                >
                  No pages on the latest scan.
                </p>
              </div>
            </template>
          </UTable>
        </div>

        <div
          class="issues-table-right-shadow"
          :class="{ 'issues-table-right-shadow--visible': hasRightOverflowShadow }"
          aria-hidden="true"
        />
        <div
          v-show="hasRightOverflowShadow && headerRowHeightPx > 0"
          class="issues-table-header-cap"
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
        <div class="flex items-center gap-2 ms-auto">
          <UPagination
            v-if="showPagination"
            :page="serverPaginated ? page : (table?.tableApi?.getState().pagination.pageIndex ?? 0) + 1"
            :items-per-page="serverPaginated ? pageSize : pagination.pageSize"
            :total="filteredRowCount"
            @update:page="onPaginationChange"
          />
          <TableFooterLinkButton
            v-if="footerLink"
            :to="footerLink.to"
            :label="footerLink.label"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.issues-table-panel {
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.issues-table-surface {
  display: block;
  overflow: hidden;
  width: 100% !important;
  max-width: 100%;
  box-sizing: border-box;
}

.issues-table-viewport {
  position: relative;
  display: block;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
}

.issues-table-viewport:not(.issues-table-viewport--with-title) {
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;
}

.issues-table-scroll {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
}

.issues-table-scroll--overflow-right {
  box-shadow: inset -22px 0 22px -12px color-mix(in srgb, #000 24%, transparent 76%);
}

.issues-table-panel :deep(.issues-table-scroll [data-slot='root']) {
  width: 100%;
}

.issues-table-panel :deep(.issues-table-scroll table) {
  width: 100% !important;
  /* Prefer full width; never shrink below column mins (scroll instead of crush Issue). */
  min-width: max(100%, 124rem);
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
}

.issues-table-panel :deep(.issues-table-scroll th),
.issues-table-panel :deep(.issues-table-scroll td) {
  border-right: none;
  background-color: var(--ui-bg);
}

/* Flexible column. Absorbs leftover width so metrics sit on the right edge. */
.issues-table-panel :deep(.issues-table-issue-col) {
  width: auto;
  min-width: 28rem;
  max-width: none;
  box-sizing: border-box;
}

/* Clip Issue text inside the sticky cell; keep cell overflow visible for edge shadow. */
.issues-table-panel :deep(.issues-table-issue-cell) {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.issues-table-panel :deep(.issues-table-issue-cell p),
.issues-table-panel :deep(.issues-table-issue-cell span.truncate) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* Fixed metric widths. Wide enough for sort button + label without overlap. */
.issues-table-panel :deep(.issues-metric-col--site) {
  width: 10rem;
  min-width: 10rem;
  max-width: 10rem;
  box-sizing: border-box;
}

.issues-table-panel :deep(.issues-metric-col--type) {
  width: 9.5rem;
  min-width: 9.5rem;
  max-width: 9.5rem;
  box-sizing: border-box;
}

.issues-table-panel :deep(.issues-metric-col--level),
.issues-table-panel :deep(.issues-metric-col--severity) {
  width: 8.5rem;
  min-width: 8.5rem;
  max-width: 8.5rem;
  box-sizing: border-box;
}

.issues-table-panel :deep(.issues-metric-col--sc) {
  width: 9rem;
  min-width: 9rem;
  max-width: 9rem;
  box-sizing: border-box;
}

.issues-table-panel :deep(.issues-metric-col--role),
.issues-table-panel :deep(.issues-metric-col--element) {
  width: 9.5rem;
  min-width: 9.5rem;
  max-width: 9.5rem;
  box-sizing: border-box;
}

.issues-table-panel :deep(.issues-metric-col--pages) {
  width: 6.5rem;
  min-width: 6.5rem;
  max-width: 6.5rem;
  box-sizing: border-box;
}

.issues-table-panel :deep(.issues-metric-col--occurrences) {
  width: 9rem;
  min-width: 9rem;
  max-width: 9rem;
  box-sizing: border-box;
}

.issues-table-panel :deep(.issues-metric-col--points),
.issues-table-panel :deep(.issues-metric-col--status) {
  width: 9.5rem;
  min-width: 9.5rem;
  max-width: 9.5rem;
  box-sizing: border-box;
}

.issues-table-panel :deep(.issues-metric-col--actions) {
  width: 3.25rem;
  min-width: 3.25rem;
  max-width: 3.25rem;
  box-sizing: border-box;
}

.issues-table-panel :deep(.issues-table-scroll tbody td[colspan]) {
  padding-left: 0 !important;
  padding-right: 0 !important;
  overflow: visible !important;
}

.issues-table-expanded-panel {
  padding: 0;
  min-width: 0;
  overflow: visible;
  position: relative;
  background-color: var(--ui-bg);
}

@media (max-width: 767px) {
  .issues-table-expanded-panel {
    padding-left: 0;
    padding-right: 0;
  }
}

.issues-table-panel :deep(td.issues-table-issue-col > *),
.issues-table-panel :deep(th.issues-table-issue-col) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.issues-table-panel :deep(.issues-table-scroll thead th) {
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.issues-table-panel :deep(.issues-table-expand-col) {
  width: 2.75rem;
  min-width: 2.75rem;
  max-width: 2.75rem;
  box-shadow: none;
}

.issues-table-panel :deep(.issues-table-viewport:not(.issues-table-viewport--with-title) thead th.issues-table-expand-col) {
  border-top-left-radius: 0.5rem;
}

.issues-table-panel :deep(.issues-table-scroll tbody td) {
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.issues-table-panel :deep(.issues-table-scroll tbody tr:last-child td) {
  border-bottom: none;
}

.issues-table-panel :deep(thead tr[data-slot='separator']) {
  display: none;
}

.issues-table-panel :deep(.issues-table-sticky-col) {
  position: sticky;
  z-index: 3;
  overflow: visible;
  background-color: var(--ui-bg);
}

.issues-table-panel :deep(thead .issues-table-sticky-col) {
  z-index: 5;
  background-color: var(--ui-bg);
}

.issues-table-panel :deep(.issues-table-sticky-col--1) {
  left: 0;
  z-index: 3;
  box-shadow: none;
}

.issues-table-panel :deep(thead .issues-table-sticky-col--1) {
  z-index: 5;
}

.issues-table-panel :deep(.issues-table-sticky-col--2) {
  left: var(--issues-expand-col-width, 2.75rem);
  z-index: 4;
  overflow: visible;
  box-shadow: 6px 0 10px -8px color-mix(in srgb, #000 22%, transparent 78%);
}

.issues-table-panel :deep(thead .issues-table-sticky-col--2) {
  z-index: 6;
  overflow: hidden;
}

.issues-table-panel :deep(.issues-table-sticky-col--2)::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: color-mix(in srgb, var(--ui-border) 92%, transparent 8%);
  pointer-events: none;
  z-index: 2;
}

.issues-table-panel :deep(tbody .issues-table-sticky-col--2)::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 100%;
  width: 10px;
  pointer-events: none;
  z-index: 1;
  background: linear-gradient(
    to right,
    color-mix(in srgb, #000 14%, transparent 86%) 0%,
    transparent 100%
  );
}

.issues-table-panel :deep(thead .issues-table-sticky-col--2)::after {
  display: none;
}

.issues-table-panel :deep(.issues-table-center-col) {
  text-align: center;
}

.issues-table-right-shadow {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 12;
  width: 28px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease;
  border-top-right-radius: 0.5rem;
  background: linear-gradient(
    to left,
    color-mix(in srgb, #000 32%, transparent 68%) 0%,
    color-mix(in srgb, #000 16%, transparent 84%) 50%,
    transparent 100%
  );
}

.issues-table-right-shadow--visible {
  opacity: 1;
}

.issues-table-header-cap {
  position: absolute;
  top: 0;
  right: 0;
  width: 12px;
  z-index: 13;
  pointer-events: none;
  border-top-right-radius: 0.5rem;
  background: linear-gradient(
    to right,
    transparent 0%,
    var(--ui-bg) 100%
  );
}

@media (max-width: 1023px) {
  /* Unstick. Column mins + table min-width prevent Issue/Site overlap. */
  .issues-table-panel :deep(.issues-table-issue-col) {
    width: auto;
    min-width: 28rem;
    max-width: none;
  }

  .issues-table-panel :deep(.issues-table-sticky-col) {
    position: static;
    left: auto;
    z-index: auto;
    box-shadow: none;
    background-color: transparent;
  }

  .issues-table-panel :deep(thead .issues-table-sticky-col) {
    background-color: transparent;
  }

  .issues-table-panel :deep(.issues-table-sticky-col--2)::before,
  .issues-table-panel :deep(.issues-table-sticky-col--2)::after {
    display: none;
  }

  .issues-table-scroll--overflow-right {
    box-shadow: inset -18px 0 18px -10px color-mix(in srgb, #000 20%, transparent 80%);
  }
}

.issues-table-panel :deep(tr[data-expanded='true'] td:not(.issues-table-sticky-col)) {
  background-color: var(--ui-bg);
}

.issues-table-panel :deep(tr[data-expanded='true'] .issues-table-sticky-col) {
  background-color: var(--ui-bg);
}

/* Keep a divider under the Issue row when expanded. */
.issues-table-panel :deep(tr[data-expanded='true'] > td) {
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

/* Keep the Issue divider painting through into the expanded sub-table. */
.issues-table-panel :deep(tr[data-expanded='true'] .issues-table-sticky-col--2)::before {
  bottom: 0;
}

/* Expanded detail row sits directly under the parent. */
.issues-table-panel :deep(tr.issues-table-expanded-row > td),
.issues-table-panel :deep(tbody tr:has(.issues-table-expanded-panel) > td) {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  border-top: none;
  background-color: var(--ui-bg);
}

.issues-table-panel :deep(tbody td[colspan]) {
  background-color: var(--ui-bg);
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 90%, transparent 10%);
}

.issues-table-panel :deep(tr.issue-row--exiting) {
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
