<script setup lang="ts">
import type { OrgDashboardAggregates } from '~/utils/dashboardAggregates'
import { siteIssueBarPoints } from '~/utils/orgSiteMetrics'
import { trendDelta } from '~/utils/scanTrendSeries'
import SharedMetricTrendExpandModal from '~/components/shared/MetricTrendExpandModal.vue'

const props = defineProps<{
  siteId?: string
  orgAggregates?: OrgDashboardAggregates | null
  orgLoading?: boolean
}>()

const isOrgMode = computed(() => !props.siteId && !!props.orgAggregates)
const siteIdRef = computed(() => props.siteId ?? '')

const { brokenLinkCount, misspellingCount, policyMatchCount, avgReadability, latestScan, loading } = useQA(siteIdRef)
const qaScore = computed(() => latestScan.value?.score_qa ?? null)

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

const issueSummary = computed(() => {
  if (!props.orgAggregates) return null
  const total = props.orgAggregates.totalBrokenLinks
  return `${total} broken link${total === 1 ? '' : 's'} across all sites`
})

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

function ringColor(count: number) {
  if (count === 0) return 'text-green-500'
  if (count <= 10) return 'text-amber-500'
  return 'text-red-500'
}
</script>

<template>
  <div>
    <div v-if="isOrgMode ? orgLoading && !orgAggregates : loading" class="flex justify-center py-10">
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
                Quality assurance score
              </h2>
              <p class="text-sm text-muted">
                Average QA score across your workspace.
              </p>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-3 lg:items-stretch">
            <DashboardOrgAverageScoreCard
              title="Average QA score"
              :score="orgAggregates.avgQaScore"
              empty-label="Average QA score appears after sites complete scans."
              :issue-summary="`${orgAggregates.totalOpenQaIssues} open QA issue${orgAggregates.totalOpenQaIssues === 1 ? '' : 's'} across all sites`"
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
            <div>
              <h2 class="text-lg font-semibold text-highlighted">
                Broken links by site
              </h2>
              <p class="text-sm text-muted">
                {{ issueSummary }}
              </p>
            </div>
            <UButton to="/qa/links" size="sm" variant="outline">
              View broken links
            </UButton>
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

    <template v-else-if="siteId">
      <div class="grid items-center gap-6 lg:grid-cols-[minmax(0,12rem)_1fr] lg:gap-8">
        <div class="flex flex-col items-center justify-center gap-2">
          <AccessibilityScoreDonut
            v-if="qaScore != null"
            :score="qaScore"
            label="QA score"
          />
          <p v-else class="max-w-xs text-center text-sm text-muted">
            QA score appears after a completed scan with quality checks enabled.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <NuxtLink
            :to="`/sites/${siteId}/qa/links`"
            class="rounded-lg border border-default bg-elevated/40 p-4 transition-colors hover:border-primary/40"
          >
            <p class="text-sm text-muted">Broken links</p>
            <p class="text-2xl font-bold" :class="ringColor(brokenLinkCount)">
              {{ brokenLinkCount }}
            </p>
          </NuxtLink>
          <NuxtLink
            :to="`/sites/${siteId}/qa/spelling`"
            class="rounded-lg border border-default bg-elevated/40 p-4 transition-colors hover:border-primary/40"
          >
            <p class="text-sm text-muted">Misspellings</p>
            <p class="text-2xl font-bold" :class="ringColor(misspellingCount)">
              {{ misspellingCount }}
            </p>
          </NuxtLink>
          <NuxtLink
            :to="`/sites/${siteId}/qa/policies`"
            class="rounded-lg border border-default bg-elevated/40 p-4 transition-colors hover:border-primary/40"
          >
            <p class="text-sm text-muted">Policies</p>
            <p class="text-2xl font-bold" :class="ringColor(policyMatchCount)">
              {{ policyMatchCount }}
            </p>
          </NuxtLink>
          <div class="rounded-lg border border-default bg-elevated/40 p-4">
            <p class="text-sm text-muted">
              Readability
            </p>
            <p class="text-2xl font-bold">
              {{ avgReadability || '—' }}
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
