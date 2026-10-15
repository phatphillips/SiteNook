<script setup lang="ts">
import type { OrgDashboardAggregates } from '~/utils/dashboardAggregates'
import type { OverviewDateRange } from '~/utils/overviewDateRange'
import { siteIssueBarPoints } from '~/utils/orgSiteMetrics'
import { planHasFeature } from '~/utils/planLimits'
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
const { organization } = useTenantOrg()

const seoEnabled = computed(() =>
  planHasFeature(organization.value?.plan, 'seoModule')
)

const orgSiteIds = computed(() =>
  (props.orgAggregates?.siteSnapshots ?? []).map(snapshot => snapshot.siteId)
)

const scoreExpandOpen = ref(false)
const issuesExpandOpen = ref(false)

const {
  points: avgScoreTrendPoints,
  scans: orgScoreTrendScans,
  loading: scoreTrendLoading
} = useOrgSeoScoreTrend(orgSiteIds)

const {
  points: openIssuesTrendPoints,
  scans: orgOpenIssuesTrendScans,
  loading: openIssuesTrendLoading
} = useOrgSeoOpenIssuesTrend(orgSiteIds)

const issuesBySiteBars = computed(() => {
  if (!props.orgAggregates) return []
  return siteIssueBarPoints(
    props.orgAggregates.siteSnapshots,
    snapshot => snapshot.openSeoIssues,
    snapshot => `/sites/${snapshot.siteId}/seo`,
    12,
    {
      tooltipLines: (snapshot, value) => [
        `${value} open SEO issue${value === 1 ? '' : 's'}`,
        snapshot.seoScore != null
          ? `SEO score ${Math.round(snapshot.seoScore)}%`
          : 'No SEO score yet'
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

const openIssuesTrendDirection = computed((): 'up' | 'down' | null => {
  const delta = trendDelta(openIssuesTrendPoints.value)
  if (delta == null || delta === 0) return null
  return delta > 0 ? 'up' : 'down'
})
</script>

<template>
  <div>
    <div
      v-if="!seoEnabled"
      class="flex flex-col items-center gap-4 py-8 text-center"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-elevated/60">
        <UIcon name="i-lucide-lock" class="size-5 text-muted" />
      </div>
      <div class="max-w-sm space-y-1">
        <p class="font-medium text-highlighted">
          SEO monitoring is locked
        </p>
        <p class="text-sm text-muted">
          Unlock SEO scoring. See technical, content, and crawlability insights for your sites.
        </p>
      </div>
      <UButton to="/settings/billing" variant="outline" size="sm">
        See plans
      </UButton>
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
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-highlighted">
                SEO score
              </h2>
              <p class="text-sm text-muted">
                Average SEO score across your workspace.
              </p>
            </div>
            <DashboardSectionViewLink
              to="/seo"
              label="View SEO"
            />
          </div>

          <div class="grid gap-4 lg:grid-cols-3 lg:items-stretch">
            <DashboardOrgAverageScoreCard
              title="Average SEO score"
              :score="orgAggregates.avgSeoScore"
              empty-label="Average SEO score appears after sites complete scans."
              cta-to="/seo"
              cta-label="View SEO"
            />

            <AccessibilityMetricTrendCard
              title="Score trend"
              :value="scoreTrendDeltaDisplay"
              subtitle="Average SEO score over 30 days"
              :points="avgScoreTrendPoints"
              series-label="Avg SEO score"
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
                  aria-label="Expand SEO score trend"
                  @click="scoreExpandOpen = true"
                />
              </template>
            </AccessibilityMetricTrendCard>

            <AccessibilityMetricTrendCard
              title="Open issues"
              :value="String(orgAggregates.totalOpenSeoIssues)"
              subtitle="Open SEO issues over 30 days"
              :points="openIssuesTrendPoints"
              series-label="Open SEO issues"
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
                  aria-label="Expand open SEO issues trend"
                  @click="issuesExpandOpen = true"
                />
              </template>
            </AccessibilityMetricTrendCard>
          </div>
        </section>

        <SharedMetricTrendExpandModal
          v-model:open="scoreExpandOpen"
          kind="seo_score"
          mode="org"
          :scans="orgScoreTrendScans"
          :loading="scoreTrendLoading"
          title="Average SEO score"
        />

        <SharedMetricTrendExpandModal
          v-model:open="issuesExpandOpen"
          kind="seo_issues"
          mode="org"
          :scans="orgOpenIssuesTrendScans"
          :loading="openIssuesTrendLoading"
          title="Open SEO issues"
        />

        <section class="scroll-mt-6">
          <div class="mb-4 flex items-end justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-highlighted">
                Open issues by site
              </h2>
              <p class="text-sm text-muted">
                Compare open SEO issues across your sites.
              </p>
            </div>
            <DashboardSectionViewLink
              to="/seo/technical"
              label="View SEO issues"
            />
          </div>

          <AccessibilitySiteIssuesBarCard
            title="Open issues by site"
            :value="String(orgAggregates.totalOpenSeoIssues)"
            subtitle="Open SEO issues across sites"
            :points="issuesBySiteBars"
            series-label="Issues"
            :empty-label="openIssuesTrendLoading && !issuesBySiteBars.length ? 'Loading…' : 'No open issues'"
          />
        </section>
      </div>
      <p v-else class="py-4 text-sm text-muted">
        Org dashboard data is not available yet.
      </p>
    </template>

    <SeoSiteOverviewPanel
      v-else-if="siteId"
      :site-id="siteId"
      :sync-active-site="false"
      :show-toolbar="false"
      v-model:date-range="dateRange"
    />
  </div>
</template>
