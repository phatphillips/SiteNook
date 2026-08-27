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
  charts?: 'both' | 'score' | 'issues'
  tall?: boolean
  expandScans?: Scan[]
  seoScore?: number | null
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
    scan => scan.score_seo ?? null,
    props.rangeBounds
  )
)

const issuePoints = computed(() =>
  buildDailyTrendSeries(
    completedScansInRange.value,
    scan => scan.open_seo_count ?? null,
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
  if (props.seoScore != null) return `${Math.round(props.seoScore)}%`
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

const issuesTrendDirection = computed(() =>
  directionFromDelta(issuesTrendDelta.value)
)

const scoreExpandOpen = ref(false)
const issuesExpandOpen = ref(false)

const showScoreChart = computed(() => chartsMode.value === 'both' || chartsMode.value === 'score')
const showIssuesChart = computed(() =>
  chartsMode.value === 'both' || chartsMode.value === 'issues'
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
        title="SEO score trend"
        :value="scoreValue"
        :subtitle="`SEO score ${periodLabel}`"
        :trend-delta-text="scoreDeltaText"
        :points="scorePoints"
        series-label="SEO score"
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
            aria-label="Expand SEO score trend"
            @click="scoreExpandOpen = true"
          />
        </template>
      </AccessibilityMetricTrendCard>

      <AccessibilityMetricTrendCard
        v-if="showIssuesChart"
        title="Open issues"
        :value="issueValue"
        :subtitle="`Open SEO issues ${periodLabel}`"
        :trend-delta-text="issuesDeltaText"
        :points="issuePoints"
        series-label="Open SEO issues"
        tone="purple"
        show-axes
        guide-line-preset="quarters"
        :chart-min-height="chartMinHeight"
        :trend-direction="issuesTrendDirection"
        :delta-positive-is-good="false"
        :y-min="0"
      >
        <template #header-actions>
          <UButton
            icon="i-lucide-maximize-2"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Expand open SEO issues trend"
            @click="issuesExpandOpen = true"
          />
        </template>
      </AccessibilityMetricTrendCard>
    </div>

    <SharedMetricTrendExpandModal
      v-if="showScoreChart"
      v-model:open="scoreExpandOpen"
      kind="seo_score"
      mode="site"
      :scans="expandModalScans"
      title="SEO score trend"
    />

    <SharedMetricTrendExpandModal
      v-if="showIssuesChart"
      v-model:open="issuesExpandOpen"
      kind="seo_issues"
      mode="site"
      :scans="expandModalScans"
      title="Open SEO issues"
    />
  </div>
</template>
