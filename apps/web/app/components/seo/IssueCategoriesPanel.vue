<script setup lang="ts">
import type { SeoIssueBreakdownRow } from '~/utils/seoIssueBreakdown'
import { totalOpenSeoIssues } from '~/utils/seoIssueBreakdown'

const props = defineProps<{
  rows: SeoIssueBreakdownRow[]
  /** Category currently shown in the info modal (selection highlight). */
  selectedCategoryId?: string | null
}>()

const emit = defineEmits<{
  select: [row: SeoIssueBreakdownRow]
}>()

const hoveredCategoryId = ref<string | null>(null)
const rowsRef = ref<HTMLElement | null>(null)

const ISSUE_CATEGORIES_TOOLTIP =
  'Open SEO findings from the latest scan, grouped by check type. Select a row for guidance and next steps.'

const openIssueTotal = computed(() =>
  totalOpenSeoIssues({
    technical: props.rows.find(row => row.id === 'technical')?.count ?? 0,
    crawlability: props.rows.find(row => row.id === 'crawlability')?.count ?? 0,
    content: props.rows.find(row => row.id === 'content')?.count ?? 0
  })
)

const maxIssueCount = computed(() =>
  Math.max(1, ...props.rows.map(row => row.count))
)

function barPercent(count: number): number {
  if (count <= 0) return 0
  return (count / maxIssueCount.value) * 100
}

function isWithinRows(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false
  return Boolean(rowsRef.value?.contains(target))
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
    class="score-conformance-card flex h-full min-h-0 flex-col gap-3 rounded-lg border border-default bg-elevated p-4 sm:p-5"
  >
    <div class="flex min-h-[18px] items-center gap-1.5">
      <p class="text-sm font-bold text-default">
        Issue categories
      </p>
      <UTooltip :text="ISSUE_CATEGORIES_TOOLTIP" :popper="{ placement: 'top' }">
        <button
          type="button"
          class="text-muted transition-colors hover:text-default"
          aria-label="About issue categories"
        >
          <UIcon name="i-lucide-circle-help" class="size-3.5" />
        </button>
      </UTooltip>
    </div>

    <p v-if="!openIssueTotal" class="py-4 text-center text-sm text-muted">
      No open SEO issues on the latest scan.
    </p>

    <div ref="rowsRef" class="flex flex-1 flex-col justify-center gap-2">
      <QaIssueCategoryRow
        v-for="row in rows"
        :key="row.id"
        :icon="row.icon"
        :accent-color="row.accentColor"
        :label="row.label"
        :count="row.count"
        :bar-percent="barPercent(row.count)"
        :active="hoveredCategoryId === row.id"
        :selected="selectedCategoryId === row.id"
        @click="emit('select', row)"
        @mouseenter="onRowEnter(row.id)"
        @mouseleave="onRowLeave(row.id, $event)"
        @focus="onRowEnter(row.id)"
        @blur="onRowBlur(row.id, $event)"
      />
    </div>

    <p v-if="openIssueTotal" class="pt-1 text-center text-xs text-muted">
      {{ openIssueTotal.toLocaleString() }} open issue{{ openIssueTotal === 1 ? '' : 's' }} across categories
    </p>
  </div>
</template>
