<script setup lang="ts">
import AccessibilityIssuesTrendExpandModal from '~/components/accessibility/IssuesTrendExpandModal.vue'
import AccessibilityScoreTrendExpandModal from '~/components/accessibility/ScoreTrendExpandModal.vue'
import type { OrgDashboardAggregates } from '~/utils/dashboardAggregates'
import { siteIssueBarPoints } from '~/utils/orgSiteMetrics'
import { trendDelta } from '~/utils/scanTrendSeries'
import { trafficLightFromCount } from '~/utils/trafficLightStatus'

const props = defineProps<{
  siteId?: string
  orgAggregates?: OrgDashboardAggregates | null
  orgLoading?: boolean
}>()

const isOrgMode = computed(() => !props.siteId && !!props.orgAggregates)

const siteIdRef = computed(() => props.siteId ?? '')

const {
  currentA11y,
  loading,
  displayScore,
  openIssueCount
} = useAccessibilitySummary(siteIdRef)

const orgSiteIds = computed(() =>
  (props.orgAggregates?.siteSnapshots ?? []).map(snapshot => snapshot.siteId)
)

const {
  points: avgScoreTrendPoints,
  scans: orgScoreTrendScans,
  loading: scoreTrendLoading
} = useOrgA11yScoreTrend(orgSiteIds)

const scoreExpandOpen = ref(false)
const issuesExpandOpen = ref(false)

const {
  points: openIssuesTrendPoints,
  scans: orgOpenIssuesTrendScans,
  latestOpenCount,
  loading: openIssuesTrendLoading
} = useOrgA11yOpenIssuesTrend(orgSiteIds)

const issuesBySiteBars = computed(() => {
  if (!props.orgAggregates) return []
  return siteIssueBarPoints(
    props.orgAggregates.siteSnapshots,
    snapshot => snapshot.openA11yIssues,
    snapshot => `/sites/${snapshot.siteId}/accessibility/issues`
  )
})

const scoreTrendDelta = computed(() => trendDelta(avgScoreTrendPoints.value))

const scoreTrendDeltaDisplay = computed(() => {
  const delta = scoreTrendDelta.value
  if (delta == null) return '—'
  const abs = Math.abs(delta)
  const rounded = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/\.?0+$/, '')
  return `${rounded}%`
})

const scoreTrendDirection = computed((): 'up' | 'down' | null => {
  const delta = scoreTrendDelta.value
  if (delta == null || delta === 0) return null
  return delta > 0 ? 'up' : 'down'
})

/** Open-issue stock: up = more open issues, down = fewer. */
const openIssuesTrendDirection = computed((): 'up' | 'down' | null => {
  const delta = trendDelta(openIssuesTrendPoints.value)
  if (delta == null || delta === 0) return null
  return delta > 0 ? 'up' : 'down'
})

const issueSummary = computed(() => {
  if (!props.orgAggregates) return null
  const total = props.orgAggregates.totalOpenA11yIssues
  return `${total} open issue${total === 1 ? '' : 's'} across all sites`
})

const severity = computed(() =>
  currentA11y.value?.by_severity ?? { critical: 0, serious: 0, moderate: 0, minor: 0 }
)

const metricCards = computed(() => {
  const s = severity.value
  return [
    {
      label: 'Critical',
      count: s.critical,
      to: `/sites/${props.siteId}/accessibility/issues?impact=critical`
    },
    {
      label: 'Serious',
      count: s.serious,
      to: `/sites/${props.siteId}/accessibility/issues?impact=serious`
    },
    {
      label: 'Moderate',
      count: s.moderate,
      to: `/sites/${props.siteId}/accessibility/issues?impact=moderate`
    },
    {
      label: 'Minor',
      count: s.minor,
      to: `/sites/${props.siteId}/accessibility/issues?impact=minor`
    }
  ]
})

function ringColor(count: number) {
  if (count === 0) return 'text-green-500'
  if (count <= 10) return 'text-amber-500'
  return 'text-red-500'
}

</script>

<template>
  <div>
    <div v-if="!isOrgMode && loading" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-muted" />
    </div>

    <template v-else-if="isOrgMode">
      <div v-if="orgLoading && !orgAggregates" class="flex justify-center py-10">
        <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-muted" />
      </div>
      <div
        v-else-if="orgAggregates"
        class="space-y-8"
      >
        <section class="scroll-mt-6">
          <div class="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">
                Accessibility score
              </h2>
              <p class="text-sm text-muted">
                Average accessibility score across your workspace.
              </p>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-3 lg:items-stretch">
            <DashboardOrgAverageScoreCard
              :score="orgAggregates.avgAccessibilityScore"
              empty-label="Average score appears after sites complete scans."
            />

            <AccessibilityMetricTrendCard
              title="Score trend"
              :value="scoreTrendDeltaDisplay"
              subtitle="Average accessibility score over 30 days"
              :points="avgScoreTrendPoints"
              series-label="Avg score"
              tone="purple"
              show-grid
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
              title="Open issues"
              :value="String(latestOpenCount)"
              subtitle="Open accessibility issues over 30 days"
              :points="openIssuesTrendPoints"
              series-label="Open issues"
              tone="purple"
              show-grid
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
        </section>

        <AccessibilityScoreTrendExpandModal
          v-model:open="scoreExpandOpen"
          mode="org"
          :scans="orgScoreTrendScans"
          :loading="scoreTrendLoading"
          title="Average accessibility score"
        />

        <AccessibilityIssuesTrendExpandModal
          v-model:open="issuesExpandOpen"
          mode="org"
          :scans="orgOpenIssuesTrendScans"
          :loading="openIssuesTrendLoading"
          title="Open issues"
        />

        <section class="scroll-mt-6">
          <div class="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">
                Open issues by site
              </h2>
              <p class="text-sm text-muted">
                {{ issueSummary }}
              </p>
            </div>
            <UButton to="/accessibility/issues" size="sm" variant="outline">
              View issues
            </UButton>
          </div>

          <AccessibilitySiteIssuesBarCard
            title="Open issues by site"
            :value="String(orgAggregates.totalOpenA11yIssues)"
            subtitle="Open accessibility issues across sites"
            :points="issuesBySiteBars"
            series-label="Issues"
            :empty-label="scoreTrendLoading && !issuesBySiteBars.length ? 'Loading…' : 'No open issues'"
          />
        </section>
      </div>
      <p v-else class="py-4 text-sm text-muted">
        Org dashboard data is not available yet.
      </p>
    </template>

    <template v-else-if="siteId">
      <div class="grid items-center gap-6 lg:grid-cols-[minmax(0,12rem)_1fr] lg:gap-8">
        <div class="flex flex-col items-center justify-center gap-2">
          <AccessibilityScoreDonut
            v-if="displayScore != null"
            :score="displayScore"
            label="Accessibility score"
          />
          <p v-else class="max-w-xs text-center text-sm text-muted">
            Accessibility score appears after a completed scan.
          </p>
          <p v-if="openIssueCount" class="text-sm text-muted">
            {{ openIssueCount }} open issue{{ openIssueCount === 1 ? '' : 's' }}
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <NuxtLink
            v-for="card in metricCards"
            :key="card.label"
            :to="card.to"
            class="rounded-lg border border-default bg-elevated/40 p-4 transition-colors hover:border-primary/40"
          >
            <div class="mb-1 flex items-center gap-2">
              <TrafficLightDot :status="trafficLightFromCount(card.count)" />
              <p class="text-sm text-muted">
                {{ card.label }}
              </p>
            </div>
            <p class="text-2xl font-bold" :class="ringColor(card.count)">
              {{ card.count }}
            </p>
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>
