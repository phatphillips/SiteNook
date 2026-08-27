<script setup lang="ts">
import type { Scan } from '~/types/sitenook'
import type { DateRangeBounds } from '~/utils/overviewDateRange'
import {
  buildDailyTrendSeries,
  trendDelta
} from '~/utils/scanTrendSeries'
import { formatAccessibilityScore } from '~/utils/siteimproveScore'
import SharedMetricTrendExpandModal from '~/components/shared/MetricTrendExpandModal.vue'

const props = defineProps<{
  scans: Scan[]
  rangeBounds: DateRangeBounds
  /** Which trend cards to render (default: both side by side). */
  charts?: 'both' | 'score' | 'broken_links'
  /** Taller plot area for single-chart layouts. */
  tall?: boolean
  /**
   * Full scan history for the expand modal (independent of page date filters).
   * Falls back to `scans` when omitted.
   */
  expandScans?: Scan[]
  qaScore?: number | null
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

const scorePoints = computed(() =>
  buildDailyTrendSeries(
    completedScansInRange.value,
    scan => scan.score_qa ?? null,
    props.rangeBounds
  )
)

const brokenLinkPoints = computed(() =>
  buildDailyTrendSeries(
    completedScansInRange.value,
    scan => scan.broken_link_count ?? null,
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
const brokenLinksTrendDelta = computed(() => trendDelta(brokenLinkPoints.value))

const scoreValue = computed(() => {
  if (props.qaScore != null) return `${Math.round(props.qaScore)}%`
  const latest = latestValue(scorePoints.value)
  return latest == null ? '—' : `${formatAccessibilityScore(latest)}%`
})

const scoreDeltaText = computed(() => formatAbsolutePercentChange(scoreTrendDelta.value))

const scoreTrendDirection = computed(() =>
  directionFromDelta(scoreTrendDelta.value)
)

const brokenLinkValue = computed(() => {
  const latest = latestValue(brokenLinkPoints.value)
  return latest == null ? '—' : String(latest)
})

const brokenLinksDeltaText = computed(() => formatCountDelta(brokenLinksTrendDelta.value))

const brokenLinksTrendDirection = computed(() =>
  directionFromDelta(brokenLinksTrendDelta.value)
)

const scoreExpandOpen = ref(false)
const brokenLinksExpandOpen = ref(false)

const showScoreChart = computed(() => chartsMode.value === 'both' || chartsMode.value === 'score')
const showBrokenLinksChart = computed(() =>
  chartsMode.value === 'both' || chartsMode.value === 'broken_links'
)
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
        title="QA score trend"
        :value="scoreValue"
        :subtitle="`QA score ${periodLabel}`"
        :trend-delta-text="scoreDeltaText"
        :points="scorePoints"
        series-label="QA score"
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
            aria-label="Expand QA score trend"
            @click="scoreExpandOpen = true"
          />
        </template>
      </AccessibilityMetricTrendCard>

      <AccessibilityMetricTrendCard
        v-if="showBrokenLinksChart"
        title="Broken links"
        :value="brokenLinkValue"
        :subtitle="`Broken links ${periodLabel}`"
        :trend-delta-text="brokenLinksDeltaText"
        :points="brokenLinkPoints"
        series-label="Broken links"
        tone="purple"
        show-axes
        guide-line-preset="quarters"
        :chart-min-height="chartMinHeight"
        :trend-direction="brokenLinksTrendDirection"
        :delta-positive-is-good="false"
        :y-min="0"
      >
        <template #header-actions>
          <UButton
            icon="i-lucide-maximize-2"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Expand broken links trend"
            @click="brokenLinksExpandOpen = true"
          />
        </template>
      </AccessibilityMetricTrendCard>
    </div>

    <SharedMetricTrendExpandModal
      v-if="showScoreChart"
      v-model:open="scoreExpandOpen"
      kind="qa_score"
      mode="site"
      :scans="expandModalScans"
      title="QA score trend"
    />

    <SharedMetricTrendExpandModal
      v-if="showBrokenLinksChart"
      v-model:open="brokenLinksExpandOpen"
      kind="broken_links"
      mode="site"
      :scans="expandModalScans"
      title="Broken links"
    />
  </div>
</template>
