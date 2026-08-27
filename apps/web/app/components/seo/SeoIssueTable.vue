<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { getExpandedRowModel, getSortedRowModel } from '@tanstack/vue-table'
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

const props = withDefaults(defineProps<{
  issues: SeoIssue[]
  /** Skip the outer table surface when nested in a preview card. */
  embedded?: boolean
}>(), {
  embedded: false
})

const emit = defineEmits<{
  select: [issue: SeoIssue]
}>()

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const TrafficLightDot = resolveComponent('TrafficLightDot')

const expanded = ref<Record<string, boolean>>({})
const sorting = ref<SortingState>([{ id: 'severity', desc: true }])

const groupedIssues = computed(() => uniqueSeoByRule(props.issues))
const affectedPagesByRule = computed(() => buildSeoAffectedPagesByRule(props.issues))

const SEVERITY_SORT: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1
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

function sortableHeader(column: Column<SeoIssue, unknown>, label: string) {
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

const columns = computed((): TableColumn<SeoIssue>[] => [
  {
    id: 'expand',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => {
      if (pageCount(row.original.rule_id) === 0) return null
      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        icon: 'i-lucide-chevron-down',
        square: true,
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
  },
  {
    id: 'severity',
    accessorFn: row => SEVERITY_SORT[row.severity] ?? 0,
    header: ({ column }) => sortableHeader(column, 'Severity'),
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
    header: ({ column }) => sortableHeader(column, 'Pages'),
    meta: { class: { th: 'text-right', td: 'text-right' } },
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
    meta: { class: { td: 'text-right w-10' } },
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
])
</script>

<template>
  <div v-if="!groupedIssues.length" class="text-sm text-muted py-8 text-center">
    No SEO issues found for this view.
  </div>
  <div v-else :class="embedded ? 'overflow-x-auto' : 'table-surface overflow-x-auto'">
    <UTable
      v-model:expanded="expanded"
      v-model:sorting="sorting"
      :data="groupedIssues"
      :columns="columns"
      :expanded-options="{ getExpandedRowModel: getExpandedRowModel() }"
      :sorting-options="{ getSortedRowModel: getSortedRowModel() }"
      :ui="{ root: 'relative w-full', tr: 'data-[expanded=true]:bg-elevated/50' }"
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
</template>
