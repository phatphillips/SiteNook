<script setup lang="ts">
import type { AccessibilityIssue, Scan } from '~/types/sitenook'
import type { SiteSettings, AccessibilityScoreCategoryId, AccessibilityScoreDetailRow } from '~/utils/siteSettings'
import type { DateRangeBounds } from '~/utils/overviewDateRange'
import { accessibilityScoreDetailRows } from '~/utils/siteSettings'
import type { ElementTotals, TargetCategoryScores } from '~/utils/siteimproveScore'
import type { A11yCheckStats } from '~/utils/a11yCheckStats'
import {
  categoryScoreImpact,
  potentialOverallScoreForCategory
} from '~/utils/scoreCategoryDetails'
import { CHART_PURPLE_COLOR } from '~/utils/chartTheme'

const props = defineProps<{
  settings: SiteSettings
  categoryScores: TargetCategoryScores
  overallScore: number
  /** True while a background score reconcile is in flight after issue actions. */
  scoreUpdating?: boolean
  siteId: string
  latestScanIssues: AccessibilityIssue[]
  scoringIssues: AccessibilityIssue[]
  scoreElementTotals?: ElementTotals | null
  checkStats?: A11yCheckStats | null
  scans: Scan[]
  rangeBounds: DateRangeBounds
  /** Full scan history for score-trend expand modal (optional). */
  expandScans?: Scan[]
}>()

const selectedCategory = ref<AccessibilityScoreCategoryId | null>(null)
const hoveredCategory = ref<AccessibilityScoreCategoryId | null>(null)
const impactModalOpen = ref(false)

const scoreRowsRef = ref<HTMLElement | null>(null)

const CONFORMANCE_LEVELS_TOOLTIP =
  'Per-category progress toward 100% for each level and practice included in your site target.'

const detailRows = computed(() => accessibilityScoreDetailRows(props.settings))

const selectedRow = computed((): AccessibilityScoreDetailRow | null => {
  if (!selectedCategory.value) return null
  return detailRows.value.find(r => r.id === selectedCategory.value) ?? null
})

const selectedScore = computed(() => {
  const row = selectedRow.value
  if (!row) return 0
  return scoreForRow(row)
})

const hoveredPotentialScore = computed(() => {
  if (impactModalOpen.value) return null
  const categoryId = hoveredCategory.value
  if (!categoryId) return null
  const impact = categoryScoreImpact(categoryId, props.scoringIssues, props.scoreElementTotals, props.checkStats)
  if (impact <= 0) return null
  return potentialOverallScoreForCategory(
    categoryId,
    props.overallScore,
    props.scoringIssues,
    props.scoreElementTotals,
    props.checkStats
  )
})

function scoreForRow(row: AccessibilityScoreDetailRow): number {
  switch (row.id) {
    case 'A': return props.categoryScores.levelA
    case 'AA': return props.categoryScores.levelAA
    case 'AAA': return props.categoryScores.levelAAA
    case 'aria': return props.categoryScores.aria
    case 'best_practice': return props.categoryScores.bestPractice
    default: return 0
  }
}

function isRowHovered(categoryId: AccessibilityScoreCategoryId): boolean {
  return hoveredCategory.value === categoryId
}

function isRowSelected(categoryId: AccessibilityScoreCategoryId): boolean {
  return impactModalOpen.value && selectedCategory.value === categoryId
}

function openRowModal(categoryId: AccessibilityScoreCategoryId) {
  selectedCategory.value = categoryId
  impactModalOpen.value = true
}

function openOverallModal() {
  selectedCategory.value = null
  impactModalOpen.value = true
}

function onCategoryEnter(categoryId: AccessibilityScoreCategoryId) {
  hoveredCategory.value = categoryId
}

function isWithinScoreRows(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false
  return Boolean(scoreRowsRef.value?.contains(target))
}

function onCategoryLeave(categoryId: AccessibilityScoreCategoryId, event: MouseEvent) {
  if (isWithinScoreRows(event.relatedTarget)) return
  if (hoveredCategory.value === categoryId) {
    hoveredCategory.value = null
  }
}

function onCategoryBlur(categoryId: AccessibilityScoreCategoryId, event: FocusEvent) {
  if (isWithinScoreRows(event.relatedTarget)) return
  if (hoveredCategory.value === categoryId) {
    hoveredCategory.value = null
  }
}

watch(impactModalOpen, (open) => {
  if (!open) {
    selectedCategory.value = null
  }
})

const emit = defineEmits<{
  'open-issue': [issue: AccessibilityIssue]
}>()
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Row 1: site target score + conformance levels -->
    <div class="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <div class="flex h-full flex-col rounded-lg border border-default bg-elevated/25 p-4 shadow-none ring-0 sm:p-5">
        <div class="mb-4 flex min-h-[18px] flex-col items-start gap-1">
          <h3 class="text-lg font-semibold text-highlighted">
            Accessibility score
          </h3>
          <p class="text-sm text-muted">
            Score and trends for this site over the selected period.
          </p>
        </div>
        <div class="flex flex-1 flex-col items-center justify-center">
          <div class="relative inline-flex" :class="scoreUpdating ? 'opacity-70' : ''">
            <AccessibilityScoreDonut
              variant="site-target"
              :score="overallScore"
              :ring-color="CHART_PURPLE_COLOR"
              hover-zoom
              :potential-score="hoveredPotentialScore"
              :score-updating="scoreUpdating"
            />
          </div>
        </div>
      </div>

      <div
        class="score-conformance-card flex h-full min-h-0 flex-col gap-3 rounded-lg border border-default bg-elevated/25 p-4 shadow-none ring-0 sm:p-5"
      >
        <div class="flex min-h-[18px] items-center gap-1.5">
          <p class="text-base font-semibold text-highlighted">
            Conformance levels
          </p>
          <UTooltip :text="CONFORMANCE_LEVELS_TOOLTIP" :popper="{ placement: 'top' }">
            <button
              type="button"
              class="text-muted transition-colors hover:text-default"
              aria-label="About conformance levels"
            >
              <UIcon name="i-lucide-circle-help" class="size-3.5" />
            </button>
          </UTooltip>
        </div>

        <div ref="scoreRowsRef" class="flex flex-1 flex-col justify-center gap-2">
          <AccessibilityScoreDetailRow
            v-for="row in detailRows"
            :key="row.id"
            :badge="row.badge"
            :badge-class="row.badgeClass"
            :label="row.label"
            :score="scoreForRow(row)"
            :active="isRowHovered(row.id)"
            :selected="isRowSelected(row.id)"
            @click="openRowModal(row.id)"
            @mouseenter="onCategoryEnter(row.id)"
            @mouseleave="onCategoryLeave(row.id, $event)"
            @focus="onCategoryEnter(row.id)"
            @blur="onCategoryBlur(row.id, $event)"
          />
        </div>
      </div>
    </div>

    <!-- Row 2: score trend + open issues (left) | score details spanning both (right) -->
    <div class="grid gap-4 lg:grid-cols-5 lg:items-stretch">
      <div class="flex min-h-0 flex-col gap-4 lg:col-span-3">
        <AccessibilityTrendMetrics
          charts="score"
          tall
          :scans="scans"
          :range-bounds="rangeBounds"
          :expand-scans="expandScans"
          :current-score="overallScore"
        />
        <AccessibilityTrendMetrics
          charts="issues"
          tall
          :scans="scans"
          :range-bounds="rangeBounds"
          :expand-scans="expandScans"
        />
      </div>

      <div class="min-h-0 lg:col-span-2">
        <AccessibilityScoreCategoryInfoPanel
          class="h-full"
          :issues="latestScanIssues"
          :scoring-issues="scoringIssues"
          :score-element-totals="scoreElementTotals"
          :check-stats="checkStats"
          @open-issue="emit('open-issue', $event)"
        />
      </div>
    </div>
  </div>

  <AccessibilityScoreCategoryImpactModal
    v-model:open="impactModalOpen"
    :row="selectedRow"
    :score="selectedScore"
    :site-id="siteId"
    :issues="latestScanIssues"
    :scoring-issues="scoringIssues"
    :score-element-totals="scoreElementTotals"
    :check-stats="checkStats"
  />
</template>
