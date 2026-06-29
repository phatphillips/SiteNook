<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { upperFirst } from 'scule'
import { getExpandedRowModel, getPaginationRowModel, getSortedRowModel } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, Row, SortingState } from '@tanstack/vue-table'
import type { AccessibilityIssue } from '~/types/accessiq'
import { calculateMarginalPointsToGain, calculatePointsToGain, formatPointsToGain } from '~/composables/useAccessibility'
import type { ElementTotals } from '~/utils/siteimproveScore'
import { occurrenceCountForRule, resolvedAtMs } from '~/utils/accessibilityIssues'
import type { AffectedPageSummary } from '~/utils/affectedPages'
import { issueRowActionGroups } from '~/utils/issueActions'
import { trafficLightFromImpact } from '~/utils/trafficLightStatus'

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
  getAffectedPagesForRule?: (ruleId: string) => AffectedPageSummary[]
  loadAffectedPagesForRule?: (ruleId: string) => Promise<void>
  rescanningPageUrl?: string | null
  siteId: string
  readOnly?: boolean
  hideToolbar?: boolean
  /** Show Fixed/Dismissed column instead of points to gain. */
  showResolvedStatus?: boolean
  /** Resolved page: view-details action only. */
  resolvedActions?: boolean
  pageSize?: number
  /** Shown in the table footer (e.g. filter summary). */
  footerSummary?: string
  /** Right-aligned footer link styled as a button (overview previews). */
  footerLink?: { to: string, label: string }
  /** Section title in table header (overview previews). */
  tableTitle?: string
  /** Initial column visibility (overview: Issue, Severity, Points to gain only). */
  defaultColumnVisibility?: Record<string, boolean>
}>(), {
  readOnly: false,
  hideToolbar: false,
  showResolvedStatus: false,
  resolvedActions: false,
  pageSize: 20
})

const emit = defineEmits<{
  open: [AccessibilityIssue]
  rescan: []
  rescanPage: [pageUrl: string]
  markFixed: [ruleId: string]
  dismiss: [ruleId: string, reason: string]
}>()

const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const TrafficLightDot = resolveComponent('TrafficLightDot')
const table = useTemplateRef<{ tableApi?: { getAllColumns: () => Array<{ id: string, getCanHide: () => boolean, getIsVisible: () => boolean }>, getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } | undefined, getFilteredRowModel: () => { rows: unknown[] }, getState: () => { pagination: { pageIndex: number } }, setPageIndex: (i: number) => void } }>('table')

const globalFilter = defineModel<string>('search', { default: '' })
const pagination = ref({ pageIndex: 0, pageSize: props.pageSize })
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
  wcag_level: 'Level',
  impact: 'Severity',
  pages: 'Pages',
  occurrences: 'Occurrences',
  pointsToGain: 'Points to gain',
  resolvedAt: 'Resolved',
  resolution: 'Status',
  actions: 'Actions'
}

function ruleLabel(ruleId: string): string {
  return ruleId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
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

watch(
  () => props.issues,
  () => {
    lazyAffectedCache.value = new Map()
  }
)

function affectedPagesForIssue(issue: AccessibilityIssue): AffectedPageSummary[] {
  const fromMap = props.affectedPagesByRule?.get(issue.rule_id)
  if (fromMap?.length) return fromMap
  if (props.getAffectedPagesForRule) {
    const cached = lazyAffectedCache.value.get(issue.rule_id)
    if (cached) return cached
    const built = props.getAffectedPagesForRule(issue.rule_id)
    lazyAffectedCache.value.set(issue.rule_id, built)
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

function openIssueRow(issue: AccessibilityIssue) {
  if (props.readOnly) emit('open', issue)
}

function sortableHeader(column: Column<AccessibilityIssue, unknown>, label: string) {
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
    onMarkFixed: () => emit('markFixed', ruleId),
    onDismiss: reason => emit('dismiss', ruleId, reason),
    rescanLabel: 'Rescan page'
  })
}

const columns = computed((): TableColumn<AccessibilityIssue>[] => {
  const cols: TableColumn<AccessibilityIssue>[] = []

  if (!props.readOnly) {
    cols.push({
      id: 'expand',
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        if (pageCount(row.original) === 0) return null
        return h(UButton, {
          color: 'neutral',
          variant: 'ghost',
          icon: 'i-lucide-chevron-down',
          square: true,
          'aria-label': 'Expand affected pages',
          ui: {
            leadingIcon: ['transition-transform', row.getIsExpanded() ? 'duration-200 rotate-180' : '']
          },
          onClick: async () => {
            if (!row.getIsExpanded()) {
              await props.loadAffectedPagesForRule?.(row.original.rule_id)
            }
            row.toggleExpanded()
          }
        })
      }
    })
  }

  cols.push({
    id: 'issue',
    accessorFn: row => `${row.rule_id} ${row.description}`,
    header: ({ column }) => sortableHeader(column, 'Issue'),
    cell: ({ row }) => h('div', {
      class: ['min-w-0 max-w-xl', props.readOnly ? 'cursor-pointer' : ''],
      onClick: props.readOnly ? () => openIssueRow(row.original) : undefined
    }, [
      h('div', { class: 'flex items-start gap-2' }, [
        h(TrafficLightDot, { status: trafficLightFromImpact(row.original.impact) }),
        h('div', { class: 'min-w-0' }, [
          h('div', { class: 'flex items-center gap-2 mb-0.5' }, [
            h('span', { class: 'wcag-chip' }, row.original.wcag_level),
            h('span', { class: 'text-xs text-muted' }, ruleLabel(row.original.rule_id))
          ]),
          h('p', {
            class: 'text-sm font-medium truncate',
            title: row.original.description
          }, row.original.description)
        ])
      ])
    ])
  })
  cols.push({
    accessorKey: 'wcag_level',
    header: ({ column }) => sortableHeader(column, 'Level'),
    cell: ({ row }) => h('span', { class: 'wcag-chip' }, row.original.wcag_level)
  })
  cols.push({
    id: 'impact',
    accessorFn: row => IMPACT_SORT[row.impact] ?? 0,
    header: ({ column }) => sortableHeader(column, 'Severity'),
    cell: ({ row }) => {
      const color = severityColor(row.original.impact)
      return h('span', {
        class: `text-sm ${color === 'error' ? 'text-error' : color === 'warning' ? 'text-warning' : 'text-info'}`
      }, severityLabel(row.original.impact))
    }
  })
  cols.push({
    id: 'pages',
    accessorFn: row => pageCount(row),
    header: ({ column }) => sortableHeader(column, 'Pages'),
    meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
    cell: ({ row }) => `${pageCount(row.original)}`
  })
  cols.push({
    id: 'occurrences',
    accessorFn: row => occurrenceCount(row),
    header: ({ column }) => sortableHeader(column, 'Occurrences'),
    meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
    cell: ({ row }) => `${occurrenceCount(row.original)}`
  })

  if (props.showResolvedStatus) {
    cols.push({
      id: 'resolvedAt',
      accessorFn: row => resolvedAtMs(row),
      header: ({ column }) => sortableHeader(column, 'Resolved'),
      meta: { class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' } },
      cell: ({ row }) => {
        const ms = resolvedAtMs(row.original)
        if (!ms) return '—'
        return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      }
    })
    cols.push({
      id: 'resolution',
      accessorFn: row => row.status,
      header: ({ column }) => sortableHeader(column, 'Status'),
      cell: ({ row }) => h('span', {
        class: `text-sm ${row.original.status === 'fixed' ? 'text-success' : 'text-muted'}`
      }, row.original.status === 'fixed' ? 'Fixed' : 'Dismissed')
    })
  } else {
    cols.push({
      id: 'pointsToGain',
      accessorFn: row => pointsToGain(row),
      header: ({ column }) => sortableHeader(column, 'Points to gain'),
      meta: {
        class: { th: 'text-right tabular-nums', td: 'text-right tabular-nums' }
      },
      cell: ({ row }) => {
        const pts = pointsToGain(row.original)
        const marginal = marginalPointsToGain(row.original)
        const label = formatPointsToGain(pts)
        const prominent = pts >= 1
        const marginalLabel = formatPointsToGain(marginal)
        return h('span', {
          class: prominent
            ? 'text-sm font-semibold text-success'
            : pts > 0
              ? 'text-sm'
              : 'text-sm text-muted',
          title: marginal > 0 && marginal !== pts
            ? `${label} if all occurrences of this rule are fixed (${marginalLabel} for one occurrence)`
            : `${label} if all occurrences of this rule are fixed`
        }, label)
      }
    })
  }

  if (!props.readOnly) {
    cols.push({
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: { class: { td: 'text-right' } },
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

const filteredRowCount = computed(
  () => table.value?.tableApi?.getFilteredRowModel().rows.length ?? props.issues.length
)

const showPagination = computed(
  () => filteredRowCount.value > pagination.value.pageSize
)

const showTableFooter = computed(
  () => !!props.footerSummary || !!props.footerLink || showPagination.value
)

defineExpose({
  get columnMenuItems() {
    return columnMenuItems.value
  }
})
</script>

<template>
  <div class="issues-table-panel space-y-4">
    <div class="table-surface">
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
      <UTable
        ref="table"
        v-model:global-filter="globalFilter"
        v-model:pagination="pagination"
        v-model:expanded="expanded"
        v-model:sorting="sorting"
        v-model:column-visibility="columnVisibility"
        :data="issues"
        :columns="columns"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        :expanded-options="{ getExpandedRowModel: getExpandedRowModel() }"
        :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
        :ui="{ root: 'relative w-full', tr: 'data-[expanded=true]:bg-elevated/50' }"
      >
        <template v-if="!readOnly" #expanded="{ row }">
          <div class="px-4 py-4">
            <AccessibilityIssueAffectedPagesTable
              v-if="affectedPagesForIssue(row.original).length"
              :pages="affectedPagesForIssue(row.original)"
              :rescanning-url="rescanningPageUrl"
              @rescan="(url: string) => emit('rescanPage', url)"
            />
            <template v-else>
              <p class="text-xs text-muted mb-2">
                {{ pageCount(row.original) }} affected {{ pageCount(row.original) === 1 ? 'page' : 'pages' }}
              </p>
              <ul class="space-y-1">
                <li
                  v-for="url in pagesByRule?.get(row.original.rule_id) ?? []"
                  :key="url"
                >
                  <a
                    :href="url"
                    target="_blank"
                    rel="noopener"
                    class="text-sm text-primary hover:underline break-all"
                  >
                    {{ url }}
                  </a>
                </li>
              </ul>
            </template>
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
        <div class="flex items-center gap-2 ms-auto">
          <UPagination
            v-if="showPagination"
            :page="(table?.tableApi?.getState().pagination.pageIndex ?? 0) + 1"
            :items-per-page="pagination.pageSize"
            :total="filteredRowCount"
            @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
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
