<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { upperFirst } from 'scule'
import {
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel
} from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/vue-table'
import type { SeoIssue } from '~/types/sitenook'
import { seoIssueDescription } from '~/composables/useSeoIssueDescriptions'
import {
  buildSeoAffectedPagesByRule,
  seoAffectedPagesForRule,
  uniqueSeoByRule
} from '~/utils/seoIssues'
import { ruleLabel, severityColor } from '~/utils/seoRules'
import { trafficLightFromSeverity } from '~/utils/trafficLightStatus'
import {
  SEO_ISSUE_TABLE_SKELETON_COLUMNS,
  SEO_ISSUE_TABLE_WITH_SITE_SKELETON_COLUMNS
} from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI, dataTableSortableHeader } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'

type SeoIssueRow = SeoIssue & { siteId?: string, siteName?: string }

const props = withDefaults(defineProps<{
  issues: SeoIssueRow[]
  /** Skip the outer table surface when nested in a preview card. */
  embedded?: boolean
  loading?: boolean
  showSiteColumn?: boolean
  footerSummary?: string
  pageSize?: number
  serverPaginated?: boolean
  total?: number
  page?: number
}>(), {
  embedded: false,
  loading: false,
  showSiteColumn: false,
  footerSummary: undefined,
  pageSize: 20,
  serverPaginated: false,
  total: 0,
  page: 1
})

const emit = defineEmits<{
  select: [issue: SeoIssue]
  'update:page': [page: number]
}>()

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const TrafficLightDot = resolveComponent('TrafficLightDot')

const globalFilter = defineModel<string>('search', { default: '' })
const tablePanelRef = useTemplateRef<HTMLElement>('tablePanelRef')
const table = useTemplateRef<{
  tableApi?: {
    getAllColumns: () => Array<{ id: string, getCanHide: () => boolean, getIsVisible: () => boolean }>
    getColumn: (id: string) => { toggleVisibility: (v: boolean) => void } | undefined
    getFilteredRowModel: () => { rows: unknown[] }
    getState: () => { pagination: { pageIndex: number } }
    setPageIndex: (i: number) => void
  }
}>('table')

const expanded = ref<Record<string, boolean>>({})
const sorting = ref<SortingState>([{ id: 'severity', desc: true }])
const columnVisibility = ref<Record<string, boolean>>({})
const pagination = ref({ pageIndex: 0, pageSize: props.pageSize })
const stableLoading = useStableLoading(toRef(() => props.loading))

watch(
  () => props.pageSize,
  (size) => {
    pagination.value.pageSize = size
  }
)

const groupedIssues = computed(() => uniqueSeoByRule(props.issues))
const affectedPagesByRule = computed(() => buildSeoAffectedPagesByRule(props.issues))

const filteredIssues = computed(() => {
  const q = globalFilter.value.trim().toLowerCase()
  if (!q) return groupedIssues.value
  return groupedIssues.value.filter((issue) => {
    const label = issueLabel(issue).toLowerCase()
    const subtitle = issueSubtitle(issue.rule_id).toLowerCase()
    const site = (issue as SeoIssueRow).siteName?.toLowerCase() || ''
    return label.includes(q)
      || subtitle.includes(q)
      || issue.rule_id.toLowerCase().includes(q)
      || issue.severity.toLowerCase().includes(q)
      || site.includes(q)
  })
})

const SEVERITY_SORT: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1
}

const COLUMN_LABELS: Record<string, string> = {
  expand: 'Expand',
  issue: 'Issue',
  site: 'Site',
  severity: 'Severity',
  pages: 'Pages',
  actions: 'Actions'
}

function pageCount(ruleId: string): number {
  return affectedPagesByRule.value.get(ruleId)?.length ?? 0
}

function affectedPages(ruleId: string) {
  return seoAffectedPagesForRule(props.issues, ruleId)
}

function issueLabel(issue: SeoIssue): string {
  return issue.title || ruleLabel(issue.rule_id)
}

function issueSubtitle(ruleId: string): string {
  return seoIssueDescription(ruleId).description
}

function sortableHeader(
  column: Column<SeoIssueRow, unknown>,
  label: string,
  align: 'left' | 'right' | 'center' = 'left'
) {
  return dataTableSortableHeader(column, label, align)
}

const columns = computed((): TableColumn<SeoIssueRow>[] => {
  const cols: TableColumn<SeoIssueRow>[] = [
    {
      id: 'expand',
      enableSorting: false,
      enableHiding: false,
      meta: { class: { th: 'w-11 max-w-[2.75rem] p-0', td: 'w-11 max-w-[2.75rem] p-0 text-center' } },
      cell: ({ row }) => {
        if (pageCount(row.original.rule_id) === 0) return null
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
          onClick: (e: Event) => {
            e.stopPropagation()
            row.toggleExpanded()
          }
        })
      }
    },
    {
      id: 'issue',
      enableHiding: false,
      accessorFn: row => `${row.rule_id} ${issueLabel(row)}`,
      header: ({ column }) => sortableHeader(column, 'Issue'),
      cell: ({ row }) => h('div', {
        class: 'min-w-0 max-w-xl cursor-pointer',
        onClick: () => emit('select', row.original)
      }, [
        h('div', { class: 'flex items-start gap-2' }, [
          h(TrafficLightDot, { status: trafficLightFromSeverity(row.original.severity) }),
          h('div', { class: 'min-w-0' }, [
            h('p', { class: 'text-sm font-medium' }, issueLabel(row.original)),
            h('p', {
              class: 'text-xs text-muted line-clamp-2',
              title: issueSubtitle(row.original.rule_id)
            }, issueSubtitle(row.original.rule_id))
          ])
        ])
      ])
    }
  ]

  if (props.showSiteColumn) {
    cols.push({
      id: 'site',
      accessorFn: row => row.siteName || '',
      header: ({ column }) => sortableHeader(column, 'Site'),
      cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, row.original.siteName || '—')
    })
  }

  cols.push(
    {
      id: 'severity',
      accessorFn: row => SEVERITY_SORT[row.severity] ?? 0,
      header: ({ column }) => sortableHeader(column, 'Severity', 'center'),
      meta: { class: { th: 'text-center', td: 'text-center' } },
      cell: ({ row }) => {
        const color = severityColor(row.original.severity)
        return h('span', {
          class: `text-sm capitalize ${color}`
        }, row.original.severity)
      }
    },
    {
      id: 'pages',
      accessorFn: row => pageCount(row.rule_id),
      header: ({ column }) => sortableHeader(column, 'Pages', 'center'),
      meta: { class: { th: 'text-center', td: 'text-center' } },
      cell: ({ row }) => {
        const count = pageCount(row.original.rule_id)
        if (!count) return '—'
        return h(UBadge, {
          color: 'neutral',
          variant: 'subtle',
          size: 'sm'
        }, () => `${count} ${count === 1 ? 'page' : 'pages'}`)
      }
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: { class: { th: 'w-10', td: 'text-right w-10' } },
      cell: ({ row }) => h(UButton, {
        icon: 'i-lucide-chevron-right',
        color: 'neutral',
        variant: 'ghost',
        square: true,
        'aria-label': 'View issue details',
        onClick: (e: Event) => {
          e.stopPropagation()
          emit('select', row.original)
        }
      })
    }
  )

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
  return filteredIssues.value.length
})

const showPagination = computed(() => {
  const pageSize = props.serverPaginated ? props.pageSize : pagination.value.pageSize
  return filteredRowCount.value > pageSize
})

const showInitialSkeleton = computed(
  () => stableLoading.value && !props.issues.length
)

const showEmpty = computed(
  () => !stableLoading.value && !filteredIssues.value.length
)

const showTableFooter = computed(
  () => !!props.footerSummary || showPagination.value
)

const skeletonLayout = computed(() =>
  props.showSiteColumn
    ? SEO_ISSUE_TABLE_WITH_SITE_SKELETON_COLUMNS
    : SEO_ISSUE_TABLE_SKELETON_COLUMNS
)

const tableUi = {
  ...DATA_TABLE_UI,
  tr: 'data-[expanded=true]:bg-elevated/50 border-b border-default last:border-b-0'
}

function onPaginationChange(nextPage: number) {
  scrollDataTableIntoView(tablePanelRef.value)
  if (props.serverPaginated) {
    emit('update:page', nextPage)
    return
  }
  table.value?.tableApi?.setPageIndex(nextPage - 1)
}

watch(globalFilter, () => {
  pagination.value.pageIndex = 0
})

defineExpose({
  get columnMenuItems() {
    return columnMenuItems.value
  },
  getColumnVisibility: () => columnVisibility.value
})
</script>

<template>
  <div
    v-if="embedded"
    class="overflow-x-auto"
  >
    <UTable
      v-model:expanded="expanded"
      v-model:sorting="sorting"
      :data="filteredIssues"
      :columns="columns"
      :expanded-options="{ getExpandedRowModel: getExpandedRowModel() }"
      :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
      :ui="tableUi"
    >
      <template #expanded="{ row }">
        <div class="px-4 py-4">
          <SeoIssueAffectedPagesTable
            :pages="affectedPages(row.original.rule_id)"
            @select="(issueId: string) => {
              const issue = issues.find(i => i.id === issueId)
              if (issue) emit('select', issue)
            }"
          />
        </div>
      </template>
    </UTable>
  </div>

  <div
    v-else
    ref="tablePanelRef"
    class="seo-issues-table-panel space-y-4"
  >
    <div class="table-surface">
      <DataTableSkeleton
        v-if="showInitialSkeleton"
        :rows="pageSize"
        :layout="skeletonLayout"
      />

      <template v-else>
        <UTable
          ref="table"
          v-model:expanded="expanded"
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:column-visibility="columnVisibility"
          :data="filteredIssues"
          :columns="columns"
          :loading="stableLoading && !!issues.length"
          :pagination-options="serverPaginated ? undefined : { getPaginationRowModel: getPaginationRowModel() }"
          :expanded-options="{ getExpandedRowModel: getExpandedRowModel() }"
          :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
          :ui="tableUi"
        >
          <template #loading>
            <DataTableSkeleton
              :rows="Math.min(pageSize, 5)"
              :layout="skeletonLayout"
              :show-header="false"
            />
          </template>
          <template #expanded="{ row }">
            <div class="px-4 py-4">
              <SeoIssueAffectedPagesTable
                :pages="affectedPages(row.original.rule_id)"
                @select="(issueId: string) => {
                  const issue = issues.find(i => i.id === issueId)
                  if (issue) emit('select', issue)
                }"
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
            :page="serverPaginated ? page : (table?.tableApi?.getState().pagination.pageIndex ?? 0) + 1"
            :items-per-page="serverPaginated ? pageSize : pagination.pageSize"
            :total="filteredRowCount"
            class="ms-auto"
            @update:page="onPaginationChange"
          />
        </div>
      </template>
    </div>

    <p
      v-if="showEmpty"
      class="text-sm text-muted py-8 text-center"
    >
      No SEO issues found for this view.
    </p>
  </div>
</template>
