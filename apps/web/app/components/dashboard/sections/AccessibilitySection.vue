<script setup lang="ts">
import AccessibilityIssuesTrendExpandModal from '~/components/accessibility/IssuesTrendExpandModal.vue'
import AccessibilityScoreTrendExpandModal from '~/components/accessibility/ScoreTrendExpandModal.vue'
import type { OrgDashboardAggregates } from '~/utils/dashboardAggregates'
import type { OverviewDateRange } from '~/utils/overviewDateRange'
import { siteIssueBarPoints } from '~/utils/orgSiteMetrics'
import { trendDelta } from '~/utils/scanTrendSeries'

const props = defineProps<{
  siteId?: string
  orgAggregates?: OrgDashboardAggregates | null
  orgLoading?: boolean
}>()

/** Shared date range from the site Overview navbar (site mode only). */
const dateRange = defineModel<OverviewDateRange>('dateRange', {
  default: () => ({ preset: 30 as const })
})

const isOrgMode = computed(() => !props.siteId && !!props.orgAggregates)

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
</script>

<template>
  <div>
    <template v-if="isOrgMode">
      <div v-if="orgLoading && !orgAggregates" class="flex justify-center py-10">
        <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-muted" />
      </div>
      <div
        v-else-if="orgAggregates"
        class="space-y-8"
      >
        <section class="scroll-mt-6">
          <div class="mb-4 flex items-end justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-highlighted">
                Accessibility score
              </h2>
              <p class="text-sm text-muted">
                Average accessibility score across your workspace.
              </p>
            </div>
            <DashboardSectionViewLink
              to="/accessibility"
              label="View accessibility"
            />
          </div>

          <div class="grid gap-4 lg:grid-cols-3 lg:items-stretch">
            <DashboardOrgAverageScoreCard
              title="Average accessibility score"
              :score="orgAggregates.avgAccessibilityScore"
              empty-label="Average score appears after sites complete scans."
              cta-to="/accessibility"
              cta-label="View accessibility"
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
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-highlighted">
                Open issues by site
              </h2>
              <p class="text-sm text-muted">
                Compare open accessibility issues across your sites.
              </p>
            </div>
            <DashboardSectionViewLink
              to="/accessibility/issues"
              label="View accessibility issues"
            />
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

    <AccessibilitySiteOverviewPanel
      v-else-if="siteId"
      :site-id="siteId"
      :sync-route-site="false"
      :show-toolbar="false"
      v-model:date-range="dateRange"
    />
  </div>
</template>
