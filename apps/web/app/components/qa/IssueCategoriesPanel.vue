<script setup lang="ts">
import type { QaIssueBreakdownRow } from '~/utils/qaIssueBreakdown'
import { totalOpenQaIssues } from '~/utils/qaIssueBreakdown'

const props = defineProps<{
  rows: QaIssueBreakdownRow[]
  selectedCategoryId?: string | null
}>()

const emit = defineEmits<{
  'update:selectedCategoryId': [categoryId: string | null]
}>()

const hoveredCategoryId = ref<string | null>(null)
const rowsRef = ref<HTMLElement | null>(null)

const ISSUE_CATEGORIES_TOOLTIP =
  'Open QA findings from the latest scan, grouped by check type. Select a row to filter the preview tables below.'

const openIssueTotal = computed(() =>
  totalOpenQaIssues({
    brokenLinks: props.rows.find(row => row.id === 'broken_links')?.count ?? 0,
    misspellings: props.rows.find(row => row.id === 'misspellings')?.count ?? 0,
    policies: props.rows.find(row => row.id === 'policies')?.count ?? 0
  })
)

const maxIssueCount = computed(() =>
  Math.max(
    1,
    ...props.rows
      .filter(row => row.id !== 'inventory')
      .map(row => row.count)
  )
)

function barPercent(count: number, id: string): number {
  if (count <= 0) return 0
  if (id === 'inventory') {
    const maxInventory = Math.max(1, ...props.rows.map(row => row.count))
    return (count / maxInventory) * 100
  }
  return (count / maxIssueCount.value) * 100
}

function isWithinRows(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false
  return Boolean(rowsRef.value?.contains(target))
}

function onRowClick(row: QaIssueBreakdownRow) {
  emit(
    'update:selectedCategoryId',
    props.selectedCategoryId === row.id ? null : row.id
  )
}

function onRowEnter(categoryId: string) {
  hoveredCategoryId.value = categoryId
}

function onRowLeave(categoryId: string, event: MouseEvent) {
  if (isWithinRows(event.relatedTarget)) return
  if (hoveredCategoryId.value === categoryId) {
    hoveredCategoryId.value = null
  }
}

function onRowBlur(categoryId: string, event: FocusEvent) {
  if (isWithinRows(event.relatedTarget)) return
  if (hoveredCategoryId.value === categoryId) {
    hoveredCategoryId.value = null
  }
}
</script>

<template>
  <div
    class="score-conformance-card flex h-full min-h-0 flex-col gap-3 rounded-lg border border-default bg-elevated/25 p-4 sm:p-5"
  >
    <div class="flex min-h-[18px] items-center gap-1.5">
      <p class="text-sm font-bold text-default">
        Issue categories
      </p>
      <UTooltip :text="ISSUE_CATEGORIES_TOOLTIP" :popper="{ placement: 'top' }">
        <button
          type="button"
          class="text-muted hover:text-default transition-colors"
          aria-label="About issue categories"
        >
          <UIcon name="i-lucide-circle-help" class="size-3.5" />
        </button>
      </UTooltip>
    </div>

    <p v-if="!openIssueTotal && !rows.some(row => row.id === 'inventory' && row.count)" class="text-sm text-muted py-4 text-center">
      No open QA issues on the latest scan.
    </p>

    <div ref="rowsRef" class="flex flex-1 flex-col justify-center gap-2">
      <QaIssueCategoryRow
        v-for="row in rows"
        :key="row.id"
        :icon="row.icon"
        :accent-color="row.accentColor"
        :label="row.label"
        :count="row.count"
        :bar-percent="barPercent(row.count, row.id)"
        :active="hoveredCategoryId === row.id"
        :selected="selectedCategoryId === row.id"
        @click="onRowClick(row)"
        @mouseenter="onRowEnter(row.id)"
        @mouseleave="onRowLeave(row.id, $event)"
        @focus="onRowEnter(row.id)"
        @blur="onRowBlur(row.id, $event)"
      />
    </div>

    <p v-if="openIssueTotal" class="text-xs text-muted text-center pt-1">
      {{ openIssueTotal.toLocaleString() }} open issue{{ openIssueTotal === 1 ? '' : 's' }} across categories
    </p>
  </div>
</template>
