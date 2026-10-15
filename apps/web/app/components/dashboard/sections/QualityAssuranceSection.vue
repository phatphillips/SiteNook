<script setup lang="ts">
import type { OrgDashboardAggregates } from '~/utils/dashboardAggregates'
import type { OverviewDateRange } from '~/utils/overviewDateRange'
import { siteIssueBarPoints } from '~/utils/orgSiteMetrics'
import { trendDelta } from '~/utils/scanTrendSeries'
import SharedMetricTrendExpandModal from '~/components/shared/MetricTrendExpandModal.vue'

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

const scoreExpandOpen = ref(false)
const brokenLinksExpandOpen = ref(false)

const {
  points: avgScoreTrendPoints,
  scans: orgScoreTrendScans,
  loading: scoreTrendLoading
} = useOrgQaScoreTrend(orgSiteIds)

const {
  points: brokenLinksTrendPoints,
  scans: orgBrokenLinksTrendScans,
  latestBrokenLinkCount,
  loading: brokenLinksTrendLoading
} = useOrgQaBrokenLinksTrend(orgSiteIds)

const brokenLinksBySiteBars = computed(() => {
  if (!props.orgAggregates) return []
  return siteIssueBarPoints(
    props.orgAggregates.siteSnapshots,
    snapshot => snapshot.brokenLinkCount,
    snapshot => `/sites/${snapshot.siteId}/qa/links`,
    12,
    {
      tooltipLines: (snapshot, value) => [
        `${value} broken link${value === 1 ? '' : 's'}`,
        snapshot.qaScore != null
          ? `QA score ${Math.round(snapshot.qaScore)}%`
          : 'No QA score yet'
      ]
    }
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

const brokenLinksTrendDirection = computed((): 'up' | 'down' | null => {
  const delta = trendDelta(brokenLinksTrendPoints.value)
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
                Quality assurance score
              </h2>
              <p class="text-sm text-muted">
                Average QA score across your workspace.
              </p>
            </div>
            <DashboardSectionViewLink
              to="/qa"
              label="View quality assurance"
            />
          </div>

          <div class="grid gap-4 lg:grid-cols-3 lg:items-stretch">
            <DashboardOrgAverageScoreCard
              title="Average QA score"
              :score="orgAggregates.avgQaScore"
              empty-label="Average QA score appears after sites complete scans."
              cta-to="/qa"
              cta-label="View quality assurance"
            />

            <AccessibilityMetricTrendCard
              title="Score trend"
              :value="scoreTrendDeltaDisplay"
              subtitle="Average QA score over 30 days"
              :points="avgScoreTrendPoints"
              series-label="Avg QA score"
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
                  aria-label="Expand QA score trend"
                  @click="scoreExpandOpen = true"
                />
              </template>
            </AccessibilityMetricTrendCard>

            <AccessibilityMetricTrendCard
              title="Broken links"
              :value="String(latestBrokenLinkCount)"
              subtitle="Broken links over 30 days"
              :points="brokenLinksTrendPoints"
              series-label="Broken links"
              tone="purple"
              show-grid
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
        </section>

        <SharedMetricTrendExpandModal
          v-model:open="scoreExpandOpen"
          kind="qa_score"
          mode="org"
          :scans="orgScoreTrendScans"
          :loading="scoreTrendLoading"
          title="Average QA score"
        />

        <SharedMetricTrendExpandModal
          v-model:open="brokenLinksExpandOpen"
          kind="broken_links"
          mode="org"
          :scans="orgBrokenLinksTrendScans"
          :loading="brokenLinksTrendLoading"
          title="Broken links"
        />

        <section class="scroll-mt-6">
          <div class="mb-4 flex items-end justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-highlighted">
                Broken links by site
              </h2>
              <p class="text-sm text-muted">
                Compare broken links across your sites.
              </p>
            </div>
            <DashboardSectionViewLink
              to="/qa/links"
              label="View broken links"
            />
          </div>

          <AccessibilitySiteIssuesBarCard
            title="Broken links by site"
            :value="String(orgAggregates.totalBrokenLinks)"
            subtitle="Broken links across sites"
            :points="brokenLinksBySiteBars"
            series-label="Broken links"
            :empty-label="brokenLinksTrendLoading && !brokenLinksBySiteBars.length ? 'Loading…' : 'No broken links'"
          />
        </section>
      </div>
      <p v-else class="py-4 text-sm text-muted">
        Org dashboard data is not available yet.
      </p>
    </template>

    <QaSiteOverviewPanel
      v-else-if="siteId"
      :site-id="siteId"
      :show-toolbar="false"
      v-model:date-range="dateRange"
    />
  </div>
</template>
