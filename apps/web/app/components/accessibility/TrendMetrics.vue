<script setup lang="ts">
import type { Scan } from '~/types/sitenook'
import AccessibilityIssuesTrendExpandModal from '~/components/accessibility/IssuesTrendExpandModal.vue'
import AccessibilityScoreTrendExpandModal from '~/components/accessibility/ScoreTrendExpandModal.vue'
import {
  buildDailyTrendSeries,
  trendDelta
} from '~/utils/scanTrendSeries'

const props = defineProps<{
  scans: Scan[]
  rangeBounds: DateRangeBounds
  /** Which trend cards to render (default: both side by side). */
  charts?: 'both' | 'score' | 'issues'
  /** Taller plot area for single-chart layouts. */
  tall?: boolean
  /**
   * Full scan history for the expand modal (independent of page date filters).
   * Falls back to `scans` when omitted.
   */
  expandScans?: Scan[]
  /**
   * Live accessibility score for the latest scan (dismiss/fix aware).
   * When set, the score-trend headline and latest chart point match the overview donut.
   */
  currentScore?: number | null
}>()

const chartsMode = computed(() => props.charts ?? 'both')
const chartMinHeight = computed(() => (props.tall ? 220 : 120))

const periodLabel = computed(() => `over ${props.rangeBounds.dayCount} days`)

const completedScansInRange = computed(() =>
  props.scans.filter(
    scan => scan.status === 'complete' || scan.status === 'complete_with_errors'
  )
)

const expandModalScans = computed(() => {
  const source = props.expandScans ?? props.scans
  return source.filter(
    scan => scan.status === 'complete' || scan.status === 'complete_with_errors'
  )
})

const scorePoints = computed(() => {
  const series = buildDailyTrendSeries(
    completedScansInRange.value,
    scan => scan.score_overall ?? null,
    props.rangeBounds
  )
  if (props.currentScore == null || !series.length) return series
  const next = series.map(point => ({ ...point }))
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i]!.value != null) {
      next[i] = { ...next[i]!, value: props.currentScore }
      break
    }
  }
  // If the range has no stored points yet, still show the live score on the last day.
  if (next.every(point => point.value == null)) {
    next[next.length - 1] = { ...next[next.length - 1]!, value: props.currentScore }
  }
  return next
})

const issuePoints = computed(() =>
  buildDailyTrendSeries(
    completedScansInRange.value,
    scan => scan.open_issue_count ?? null,
    props.rangeBounds
  )
)

function latestValue(points: Array<{ value: number | null }>): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const value = points[i]?.value
    if (value != null) return value
  }
  return null
}

function formatAbsolutePercentChange(delta: number | null): string | null {
  if (delta == null || delta === 0) return null
  const abs = Math.abs(delta)
  const rounded = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/\.?0+$/, '')
  return `${rounded}%`
}

function formatCountDelta(delta: number | null): string | null {
  if (delta == null || delta === 0) return null
  const abs = Math.abs(delta)
  const rounded = Number.isInteger(abs) ? String(abs) : abs.toFixed(1)
  return rounded
}

function directionFromDelta(delta: number | null): 'up' | 'down' | null {
  if (delta == null || delta === 0) return null
  return delta > 0 ? 'up' : 'down'
}

const scoreTrendDelta = computed(() => trendDelta(scorePoints.value))
const issuesTrendDelta = computed(() => trendDelta(issuePoints.value))

const scoreValue = computed(() => {
  const latest = latestValue(scorePoints.value)
  return latest == null ? '—' : `${formatAccessibilityScore(latest)}%`
})

const scoreDeltaText = computed(() => formatAbsolutePercentChange(scoreTrendDelta.value))

const scoreTrendDirection = computed(() =>
  directionFromDelta(scoreTrendDelta.value)
)

const issueValue = computed(() => {
  const latest = latestValue(issuePoints.value)
  return latest == null ? '—' : String(latest)
})

const issuesDeltaText = computed(() => formatCountDelta(issuesTrendDelta.value))

const openIssuesTrendDirection = computed(() =>
  directionFromDelta(issuesTrendDelta.value)
)

const scoreExpandOpen = ref(false)
const issuesExpandOpen = ref(false)

const showScoreChart = computed(() => chartsMode.value === 'both' || chartsMode.value === 'score')
const showIssuesChart = computed(() => chartsMode.value === 'both' || chartsMode.value === 'issues')
</script>

<template>
  <div class="contents">
    <div
      class="h-full gap-4"
      :class="chartsMode === 'both'
        ? 'grid md:grid-cols-2 md:items-stretch'
        : 'flex flex-col'"
    >
      <AccessibilityMetricTrendCard
        v-if="showScoreChart"
        title="Score trend"
        :value="scoreValue"
        :subtitle="`Overall accessibility score ${periodLabel}`"
        :trend-delta-text="scoreDeltaText"
        :points="scorePoints"
        series-label="Score"
        tone="purple"
        show-axes
        guide-line-preset="score"
        :chart-min-height="chartMinHeight"
        :trend-direction="scoreTrendDirection"
        :format-tooltip-value="(v: number) => `${Math.round(v)}%`"
        :y-min="0"
        :y-max="100"
      >
        <template #header-actions>
          <UButton
            icon="i-lucide-maximize-2"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Expand score trend"
            @click="scoreExpandOpen = true"
          />
        </template>
      </AccessibilityMetricTrendCard>

      <AccessibilityMetricTrendCard
        v-if="showIssuesChart"
        title="Open issues"
        :value="issueValue"
        :subtitle="`Open accessibility issues ${periodLabel}`"
        :trend-delta-text="issuesDeltaText"
        :points="issuePoints"
        series-label="Open issues"
        tone="purple"
        show-axes
        guide-line-preset="quarters"
        :chart-min-height="chartMinHeight"
        :trend-direction="openIssuesTrendDirection"
        :delta-positive-is-good="false"
        :y-min="0"
      >
        <template #header-actions>
          <UButton
            icon="i-lucide-maximize-2"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Expand open issues trend"
            @click="issuesExpandOpen = true"
          />
        </template>
      </AccessibilityMetricTrendCard>
    </div>

    <AccessibilityScoreTrendExpandModal
      v-if="showScoreChart"
      v-model:open="scoreExpandOpen"
      mode="site"
      :scans="expandModalScans"
      title="Score trend"
    />

    <AccessibilityIssuesTrendExpandModal
      v-if="showIssuesChart"
      v-model:open="issuesExpandOpen"
      mode="site"
      :scans="expandModalScans"
      title="Open issues"
    />
  </div>
</template>
