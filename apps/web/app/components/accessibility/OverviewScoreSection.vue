<script setup lang="ts">
import type { AccessibilityIssue, Scan } from '~/types/sitenook'
import type { SiteSettings, AccessibilityScoreCategoryId, AccessibilityScoreDetailRow } from '~/utils/siteSettings'
import type { DateRangeBounds } from '~/utils/overviewDateRange'
import { accessibilityScoreDetailRows } from '~/utils/siteSettings'
import type { ElementTotals, TargetCategoryScores } from '~/utils/siteimproveScore'
import type { A11yCheckStats } from '~/utils/a11yCheckStats'
import {
  categoryQuickStats,
  categoryScoreImpact,
  formatScoreImpact,
  issuesLinkForCategory,
  overallScoreImpact
} from '~/utils/scoreCategoryDetails'
import { DONUT_SEGMENT_TOKENS } from '~/utils/donutChart'
import type { ScoreBreakdownModel } from '~/utils/scoreBreakdown'
import { progressScoreSlices } from '~/utils/scoreBreakdown'

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
const impactModalOpen = ref(false)
const breakdownOpen = ref(false)
const { chartStyle } = useDonutChartStyle()

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

function isRowSelected(categoryId: AccessibilityScoreCategoryId): boolean {
  return impactModalOpen.value && selectedCategory.value === categoryId
}

function openRowModal(categoryId: AccessibilityScoreCategoryId) {
  selectedCategory.value = categoryId
  impactModalOpen.value = true
}

function openBreakdownModal() {
  breakdownOpen.value = true
}

const pointsDragging = computed(() =>
  overallScoreImpact(props.scoringIssues, props.scoreElementTotals, props.checkStats)
)

const breakdownModel = computed((): ScoreBreakdownModel => {
  const rows = detailRows.value.map((row, index) => {
    const score = scoreForRow(row)
    const impact = categoryScoreImpact(
      row.id,
      props.scoringIssues,
      props.scoreElementTotals,
      props.checkStats
    )
    const stats = categoryQuickStats(props.latestScanIssues, row.id)
    return {
      id: row.id,
      label: row.label,
      value: Math.max(score, 0.01),
      color: DONUT_SEGMENT_TOKENS[index % DONUT_SEGMENT_TOKENS.length]!,
      score,
      detail: stats.occurrences
        ? `${stats.occurrences} open occurrence${stats.occurrences === 1 ? '' : 's'} · ${stats.failingRules} rule${stats.failingRules === 1 ? '' : 's'}`
        : 'No open issues in this category',
      impact: impact > 0 ? `${formatScoreImpact(impact)} pts to gain` : null,
      href: issuesLinkForCategory(props.siteId, row.id)
    }
  })

  return {
    title: 'Accessibility score breakdown',
    description: 'See how each conformance level contributes, and where fixing issues would lift the overall score.',
    score: props.overallScore,
    caption: 'Site score',
    scoreExplainer:
      'Overall accessibility score uses the Siteimprove model: 90 points for WCAG checks (weighted by level A / AA / AAA) and 10 for best practices, with progress based on failed vs total occurrences per check and a logarithmic curve near 100%.',
    slices: progressScoreSlices(props.overallScore, {
      scoreLabel: 'Current score',
      remainderLabel: 'Remaining to 100'
    }),
    rows,
    stats: [
      {
        label: 'Points to gain',
        value: formatScoreImpact(pointsDragging.value),
        hint: 'If open scoring issues were fixed'
      },
      {
        label: 'Open issues',
        value: String(props.latestScanIssues.filter(i => i.status === 'open').length)
      }
    ],
    footnote: 'WCAG checks make up most of the score (weighted A > AA > AAA). Best practices add the remaining share.',
    ctaLabel: 'View all accessibility issues',
    ctaTo: `/sites/${props.siteId}/accessibility/issues`
  }
})

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
      <div class="relative flex h-full flex-col rounded-lg border border-default bg-elevated p-4 shadow-none ring-0 sm:p-5">
        <div class="mb-4 flex min-h-[18px] items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col items-start gap-1">
            <h4 class="text-lg font-semibold text-highlighted">
              Accessibility score
            </h4>
            <p class="text-sm text-muted">
              Score and trends for this site over the selected period.
            </p>
          </div>
          <ScoreDonutMenu @breakdown="openBreakdownModal" />
        </div>
        <div class="flex flex-1 flex-col items-center justify-center overflow-visible">
          <div class="mx-auto w-full max-w-[min(100%,17.75rem)] overflow-visible">
            <ScoreDonutButton
              label="Open accessibility score breakdown"
              :class="scoreUpdating ? 'opacity-70' : ''"
              @click="openBreakdownModal"
            >
              <AccessibilityScoreDonut
                variant="site-target"
                :score="overallScore"
                ring-color="var(--ui-primary)"
                :score-updating="scoreUpdating"
                :chart-style="chartStyle"
              />
            </ScoreDonutButton>
          </div>
        </div>
      </div>

      <div
        class="score-conformance-card flex h-full min-h-0 flex-col gap-3 rounded-lg border border-default bg-elevated p-4 shadow-none ring-0 sm:p-5"
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

        <div class="flex flex-1 flex-col justify-center gap-2">
          <AccessibilityScoreDetailRow
            v-for="row in detailRows"
            :key="row.id"
            :badge="row.badge"
            :badge-class="row.badgeClass"
            :label="row.label"
            :score="scoreForRow(row)"
            :selected="isRowSelected(row.id)"
            @click="openRowModal(row.id)"
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

  <ScoreBreakdownModal
    v-model:open="breakdownOpen"
    :model="breakdownModel"
  />
</template>
