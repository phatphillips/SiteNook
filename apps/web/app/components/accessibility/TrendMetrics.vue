<script setup lang="ts">
import type { Scan } from '~/types/accessiq'
import {
  buildDailyTrendSeries,
  trendDelta
} from '~/utils/scanTrendSeries'

const props = defineProps<{
  scans: Scan[]
  pagesWithIssuesByScan: Map<string, number>
  rangeBounds: DateRangeBounds
}>()

const issuesTrendTab = ref<'issues' | 'pages'>('issues')

const issuesTrendTabItems = [
  { label: 'Issues', value: 'issues' as const },
  { label: 'Pages', value: 'pages' as const }
]

const completedScansInRange = computed(() =>
  props.scans.filter(
    scan => scan.status === 'complete' || scan.status === 'complete_with_errors'
  )
)

const scorePoints = computed(() =>
  buildDailyTrendSeries(
    completedScansInRange.value,
    scan => scan.score_overall ?? null,
    props.rangeBounds
  )
)

const issuePoints = computed(() =>
  buildDailyTrendSeries(
    props.scans,
    scan => scan.open_issue_count ?? null,
    props.rangeBounds
  )
)

const pagesPoints = computed(() =>
  buildDailyTrendSeries(
    props.scans,
    scan => props.pagesWithIssuesByScan.get(scan.id) ?? null,
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

function formatDelta(delta: number | null, suffix: string, invertGood = false): string | null {
  if (delta == null || delta === 0) return null
  const sign = delta > 0 ? '+' : ''
  const rounded = Number.isInteger(delta) ? String(delta) : delta.toFixed(1)
  const direction = invertGood
    ? (delta < 0 ? 'improved' : 'increased')
    : (delta > 0 ? 'up' : 'down')
  return `${sign}${rounded}${suffix} · ${direction} ${deltaComparisonLabel(props.rangeBounds.dayCount)}`
}

const scoreValue = computed(() => {
  const latest = latestValue(scorePoints.value)
  return latest == null ? '—' : `${formatAccessibilityScore(latest)}%`
})

const issueValue = computed(() => {
  const latest = latestValue(issuePoints.value)
  return latest == null ? '—' : String(latest)
})

const pagesValue = computed(() => {
  const latest = latestValue(pagesPoints.value)
  return latest == null ? '—' : String(latest)
})

const activeIssuesTrendTitle = computed(() =>
  issuesTrendTab.value === 'issues' ? 'Open issues' : 'Pages with issues'
)

const activeIssuesTrendValue = computed(() =>
  issuesTrendTab.value === 'issues' ? issueValue.value : pagesValue.value
)

const activeIssuesTrendSubtitle = computed(() =>
  issuesTrendTab.value === 'issues'
    ? 'Open accessibility issues'
    : 'Pages with open issues'
)

const activeIssuesTrendPoints = computed(() =>
  issuesTrendTab.value === 'issues' ? issuePoints.value : pagesPoints.value
)

const activeIssuesTrendSeriesLabel = computed(() =>
  issuesTrendTab.value === 'issues' ? 'Issues' : 'Pages'
)

const activeIssuesTrendDelta = computed(() =>
  formatDelta(
    trendDelta(activeIssuesTrendPoints.value),
    '',
    true
  )
)
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2">
    <AccessibilityMetricTrendCard
      title="Score trend"
      :value="scoreValue"
      subtitle="Overall accessibility score"
      :points="scorePoints"
      series-label="Score"
      :format-tooltip-value="(v: number) => `${Math.round(v)}%`"
      :delta-label="formatDelta(trendDelta(scorePoints), '%', false)"
      :delta-positive-is-good="true"
      :y-min="0"
      :y-max="100"
    />

    <AccessibilityMetricTrendCard
      :title="activeIssuesTrendTitle"
      :value="activeIssuesTrendValue"
      :subtitle="activeIssuesTrendSubtitle"
      :points="activeIssuesTrendPoints"
      :series-label="activeIssuesTrendSeriesLabel"
      :delta-label="activeIssuesTrendDelta"
      :delta-positive-is-good="false"
      :y-min="0"
    >
      <template #header-actions>
        <UTabs
          v-model="issuesTrendTab"
          :content="false"
          :items="issuesTrendTabItems"
          color="neutral"
          size="sm"
          class="issues-trend-tabs h-8 shrink-0"
          :ui="{
            list: 'relative flex h-8 p-0.5 rounded-lg bg-default dark:bg-elevated/50 border border-default w-auto',
            indicator: 'inset-y-0.5 rounded-md shadow-sm bg-white dark:bg-white',
            trigger: [
              'h-7 grow justify-center px-3 text-sm font-medium min-w-0',
              'data-[state=inactive]:text-muted hover:data-[state=inactive]:not-disabled:text-default',
              'data-[state=active]:bg-transparent data-[state=active]:shadow-none'
            ].join(' ')
          }"
        />
      </template>
    </AccessibilityMetricTrendCard>
  </div>
</template>

<style scoped>
.issues-trend-tabs :deep([role='tab'][data-state='active']) {
  color: rgb(10 10 10);
  z-index: 1;
}

.issues-trend-tabs :deep([role='tab'][data-state='active'] [data-slot='label']) {
  color: inherit;
}
</style>
