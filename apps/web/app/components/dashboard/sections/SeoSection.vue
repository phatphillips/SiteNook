<script setup lang="ts">
import type { OrgDashboardAggregates } from '~/utils/dashboardAggregates'
import { siteIssueBarPoints } from '~/utils/orgSiteMetrics'
import { planHasFeature } from '~/utils/planLimits'
import { trendDelta } from '~/utils/scanTrendSeries'
import { trafficLightFromCount } from '~/utils/trafficLightStatus'
import SharedMetricTrendExpandModal from '~/components/shared/MetricTrendExpandModal.vue'

const props = defineProps<{
  siteId?: string
  orgAggregates?: OrgDashboardAggregates | null
  orgLoading?: boolean
}>()

const isOrgMode = computed(() => !props.siteId && !!props.orgAggregates)
const siteIdRef = computed(() => props.siteId ?? '')
const { organization } = useTenantOrg()

const seoEnabled = computed(() =>
  planHasFeature(organization.value?.plan, 'seoModule')
)

const {
  latestScan,
  seoScore,
  technicalScore,
  contentScore,
  categoryCounts,
  loading
} = useSEO(siteIdRef)

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

const issueSummary = computed(() => {
  if (!props.orgAggregates) return null
  const total = props.orgAggregates.totalOpenSeoIssues
  return `${total} open SEO issue${total === 1 ? '' : 's'} across all sites`
})

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
          Unlock SEO scoring — see technical, content, and crawlability insights for your sites.
        </p>
      </div>
      <UButton to="/settings/billing" variant="outline" size="sm">
        See plans
      </UButton>
    </div>

    <div v-else-if="isOrgMode ? orgLoading && !orgAggregates : loading" class="flex justify-center py-10">
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
                SEO score
              </h2>
              <p class="text-sm text-muted">
                Average SEO score across your workspace.
              </p>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-3 lg:items-stretch">
            <DashboardOrgAverageScoreCard
              title="Average SEO score"
              :score="orgAggregates.avgSeoScore"
              empty-label="Average SEO score appears after sites complete scans."
              :issue-summary="issueSummary"
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
            <div>
              <h2 class="text-lg font-semibold text-highlighted">
                Open issues by site
              </h2>
              <p class="text-sm text-muted">
                {{ issueSummary }}
              </p>
            </div>
            <UButton to="/seo/technical" size="sm" variant="outline">
              View issues
            </UButton>
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

    <template v-else-if="siteId">
      <div class="grid items-center gap-6 lg:grid-cols-[minmax(0,12rem)_1fr] lg:gap-8">
        <div class="flex flex-col items-center justify-center gap-2">
          <AccessibilityScoreDonut
            v-if="seoScore != null"
            :score="seoScore"
            label="SEO score"
          />
          <p v-else class="max-w-xs text-center text-sm text-muted">
            SEO score appears after a completed scan with SEO checks enabled.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <NuxtLink
            :to="`/sites/${siteId}/seo/technical`"
            class="rounded-lg border border-default bg-elevated/40 p-4 transition-colors hover:border-primary/40"
          >
            <div class="mb-1 flex items-center gap-2">
              <TrafficLightDot :status="trafficLightFromCount(categoryCounts.technical)" />
              <p class="text-sm text-muted">Technical issues</p>
            </div>
            <p class="text-2xl font-bold">{{ categoryCounts.technical }}</p>
            <p v-if="technicalScore != null" class="mt-1 text-xs text-muted">
              Score {{ technicalScore }}
            </p>
          </NuxtLink>
          <NuxtLink
            :to="`/sites/${siteId}/seo/content`"
            class="rounded-lg border border-default bg-elevated/40 p-4 transition-colors hover:border-primary/40"
          >
            <div class="mb-1 flex items-center gap-2">
              <TrafficLightDot :status="trafficLightFromCount(categoryCounts.content)" />
              <p class="text-sm text-muted">Content issues</p>
            </div>
            <p class="text-2xl font-bold">{{ categoryCounts.content }}</p>
            <p v-if="contentScore != null" class="mt-1 text-xs text-muted">
              Score {{ contentScore }}
            </p>
          </NuxtLink>
        </div>
      </div>

      <p v-if="latestScan" class="mt-4 text-xs text-muted">
        Based on the latest completed scan with SEO checks.
      </p>
    </template>
  </div>
</template>
