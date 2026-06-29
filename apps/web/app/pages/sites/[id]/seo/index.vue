<script setup lang="ts">
import type { OverviewDateRange } from '~/utils/overviewDateRange'
import type { SeoIssue } from '~/types/accessiq'
import { filterScansByDateRange, overviewRangeBounds } from '~/utils/overviewDateRange'
import { buildDailyTrendSeries, hasEnoughTrendData } from '~/utils/scanTrendSeries'
import { siteSettingsForSite } from '~/utils/siteSettings'
import { countSeoIssuesBySeverity, topRules } from '~/utils/seoIssues'
import { ruleLabel } from '~/utils/seoRules'
import { trafficLightFromCount } from '~/utils/trafficLightStatus'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { sites, activeSiteId } = useSites()
const {
  latestScan,
  scans,
  openIssues,
  crawlAudit,
  seoScore,
  technicalScore,
  contentScore,
  crawlabilityScore,
  categoryCounts,
  crawlabilityIssues,
  contentStructureIssueCount,
  contentReadabilityIssueCount,
  avgReadabilityScore
} = useSEO(siteId)

const dateRange = ref<OverviewDateRange>({ preset: 30 })
const selectedIssue = ref<SeoIssue | null>(null)
const drawerOpen = ref(false)

const siteSettings = computed(() =>
  siteSettingsForSite(sites.value.find(s => s.id === siteId.value))
)

const rangeBounds = computed(() => overviewRangeBounds(dateRange.value))

const filteredScans = computed(() =>
  filterScansByDateRange(scans.value, rangeBounds.value)
)

const seoTrend = computed(() =>
  buildDailyTrendSeries(filteredScans.value, scan => scan.score_seo ?? null, rangeBounds.value)
)

const crawlabilityTrend = computed(() =>
  buildDailyTrendSeries(
    filteredScans.value,
    scan => scan.score_seo_crawlability ?? null,
    rangeBounds.value
  )
)

const overviewCardUi = {
  root: 'bg-elevated/25 border border-default',
  body: 'p-4 sm:p-6'
}

const topTechnicalRules = computed(() =>
  topRules(openIssues.value.filter(i =>
    i.category === 'technical' && i.subcategory !== 'crawlability'
  ))
)
const topContentRules = computed(() =>
  topRules(openIssues.value.filter(i => i.category === 'content' && !['low-readability', 'thin-content'].includes(i.rule_id)))
)

const technicalSeverityCounts = computed(() =>
  countSeoIssuesBySeverity(openIssues.value, i =>
    i.category === 'technical' && i.subcategory !== 'crawlability'
  )
)

const crawlabilitySeverityCounts = computed(() =>
  countSeoIssuesBySeverity(openIssues.value, i => i.subcategory === 'crawlability')
)

const contentSeverityCounts = computed(() =>
  countSeoIssuesBySeverity(openIssues.value, i => i.category === 'content')
)

function formatSeveritySummary(counts: { serious: number, moderate: number }): string {
  const parts: string[] = []
  if (counts.serious) parts.push(`${counts.serious} Serious`)
  if (counts.moderate) parts.push(`${counts.moderate} Moderate`)
  return parts.join(' · ') || 'No serious or moderate issues'
}

const showSeoTrend = computed(() => hasEnoughTrendData(seoTrend.value))
const showCrawlabilityTrend = computed(() => hasEnoughTrendData(crawlabilityTrend.value))

function openCrawlIssue(issue: SeoIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}

onMounted(() => {
  activeSiteId.value = siteId.value
})
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="SEO">
        <template #right><ScanTriggerButton :site-id="siteId" /></template>
      </DashboardPageNavbar>
    </template>
    <template #body>
      <SitePageToolbar class="mb-2">
        <template #trailing>
          <div class="flex flex-col items-end gap-1">
            <p class="text-xs text-muted self-stretch sm:self-end">
              Score trend period — filters the charts below only
            </p>
            <AccessibilityOverviewDateRangeControls v-model="dateRange" />
          </div>
        </template>
      </SitePageToolbar>

      <ScanStatusSummaryCard :scan="latestScan" title="SEO Data Source" class="mb-6" />

      <section class="mb-6">
        <UCard :ui="overviewCardUi">
          <div class="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
            <SiteTargetSummary variant="qa" :settings="siteSettings" />
            <div class="flex flex-col items-center justify-center gap-4 min-h-[10rem]">
              <AccessibilityScoreDonut
                v-if="seoScore != null"
                :score="seoScore"
                label="SEO score"
              />
              <p v-else class="text-sm text-muted text-center max-w-xs">
                SEO score appears after a completed scan with SEO checks enabled.
              </p>
              <div
                v-if="technicalScore != null || contentScore != null || crawlabilityScore != null"
                class="flex flex-wrap justify-center gap-6 text-sm"
              >
                <div v-if="technicalScore != null" class="text-center">
                  <p class="text-muted">Technical</p>
                  <p class="text-xl font-bold">{{ technicalScore }}</p>
                  <NuxtLink
                    :to="`/sites/${siteId}/seo/technical`"
                    class="text-xs text-muted hover:text-primary mt-1 inline-block"
                  >
                    {{ formatSeveritySummary(technicalSeverityCounts) }}
                  </NuxtLink>
                </div>
                <div v-if="crawlabilityScore != null" class="text-center">
                  <p class="text-muted">Crawlability</p>
                  <p class="text-xl font-bold">{{ crawlabilityScore }}</p>
                  <NuxtLink
                    :to="`/sites/${siteId}/seo/technical?subcategory=crawlability`"
                    class="text-xs text-muted hover:text-primary mt-1 inline-block"
                  >
                    {{ formatSeveritySummary(crawlabilitySeverityCounts) }}
                  </NuxtLink>
                </div>
                <div v-if="contentScore != null" class="text-center">
                  <p class="text-muted">Content</p>
                  <p class="text-xl font-bold">{{ contentScore }}</p>
                  <NuxtLink
                    :to="`/sites/${siteId}/seo/content`"
                    class="text-xs text-muted hover:text-primary mt-1 inline-block"
                  >
                    {{ formatSeveritySummary(contentSeverityCounts) }}
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </section>

      <SiteFilesPanel
        v-if="crawlAudit"
        :audit="crawlAudit"
        :issues="openIssues"
        class="mb-6"
        @view-issue="openCrawlIssue"
      />

      <section class="mb-6">
        <AccessibilityMetricTrendCard
          v-if="showSeoTrend"
          title="SEO score trend"
          :value="seoScore != null ? `${seoScore}%` : '—'"
          subtitle="SEO score over selected period"
          :points="seoTrend"
          series-label="SEO"
          :format-tooltip-value="(v: number) => `${Math.round(v)}%`"
          :y-min="0"
          :y-max="100"
        />
        <UCard
          v-else
          :ui="{ root: 'overflow-hidden bg-elevated/25', body: 'p-4 sm:p-5' }"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">
            SEO score trend
          </p>
          <p class="text-sm text-muted py-4 text-center">
            Not enough scan data yet. Run more scans to see your score trend over time.
          </p>
        </UCard>
      </section>

      <section v-if="showCrawlabilityTrend" class="mb-6">
        <AccessibilityMetricTrendCard
          title="Crawlability trend"
          :value="crawlabilityScore != null ? `${crawlabilityScore}%` : '—'"
          subtitle="robots.txt, sitemap, and llms.txt health"
          :points="crawlabilityTrend"
          series-label="Crawlability"
          :format-tooltip-value="(v: number) => `${Math.round(v)}%`"
          :y-min="0"
          :y-max="100"
        />
      </section>

      <div class="grid md:grid-cols-2 gap-4 mb-4">
        <UCard :to="`/sites/${siteId}/seo/technical`" class="cursor-pointer">
          <div class="flex items-center gap-2 mb-1">
            <TrafficLightDot :status="trafficLightFromCount(categoryCounts.technical)" />
            <p class="text-sm text-muted">Technical</p>
          </div>
          <p class="text-3xl font-bold">{{ categoryCounts.technical }}</p>
          <ul v-if="topTechnicalRules.length" class="mt-3 text-xs text-muted space-y-1">
            <li v-for="rule in topTechnicalRules" :key="rule" class="flex items-center gap-1.5">
              <TrafficLightDot status="orange" />
              {{ ruleLabel(rule) }}
            </li>
          </ul>
        </UCard>
        <UCard :to="`/sites/${siteId}/seo/content`" class="cursor-pointer">
          <div class="flex items-center gap-2 mb-1">
            <TrafficLightDot :status="trafficLightFromCount(categoryCounts.content)" />
            <p class="text-sm text-muted">Content</p>
          </div>
          <p class="text-3xl font-bold">{{ categoryCounts.content }}</p>
          <ul v-if="topContentRules.length" class="mt-3 text-xs text-muted space-y-1">
            <li v-for="rule in topContentRules" :key="rule">{{ ruleLabel(rule) }}</li>
          </ul>
        </UCard>
      </div>

      <div class="grid md:grid-cols-2 gap-4 mb-4">
        <UCard :to="`/sites/${siteId}/seo/technical?subcategory=crawlability`">
          <div class="flex items-center gap-2 mb-1">
            <TrafficLightDot :status="trafficLightFromCount(crawlabilityIssues.length)" />
            <p class="text-sm text-muted">Crawlability issues</p>
          </div>
          <p class="text-2xl font-bold">{{ crawlabilityIssues.length }}</p>
          <p class="text-xs text-muted mt-2">robots.txt, sitemap, llms.txt</p>
        </UCard>
        <UCard>
          <div class="flex items-center gap-2 mb-1">
            <TrafficLightDot :status="trafficLightFromCount(contentStructureIssueCount)" />
            <p class="text-sm text-muted">Content structure</p>
          </div>
          <p class="text-2xl font-bold">{{ contentStructureIssueCount }}</p>
          <p class="text-xs text-muted mt-2">Titles, headings, duplicates</p>
        </UCard>
        <UCard>
          <div class="flex items-center gap-2 mb-1">
            <TrafficLightDot :status="trafficLightFromCount(contentReadabilityIssueCount)" />
            <p class="text-sm text-muted">Readability</p>
          </div>
          <p class="text-2xl font-bold">
            {{ avgReadabilityScore != null ? `${avgReadabilityScore} Flesch` : '—' }}
          </p>
          <p class="text-xs text-muted mt-2">
            {{ contentReadabilityIssueCount }} thin / low-readability issue(s)
          </p>
        </UCard>
      </div>

      <UCard :to="`/sites/${siteId}/seo/preview`" class="cursor-pointer">
        <p class="text-sm text-muted">Search Result Preview</p>
        <p class="text-lg font-medium">Preview titles and meta descriptions in Google-style snippets</p>
      </UCard>

      <SeoIssueDetailDrawer
        :issue="selectedIssue"
        :open="drawerOpen"
        :site-id="siteId"
        @update:open="drawerOpen = $event"
      />
    </template>
  </AppDashboardPanel>
</template>
