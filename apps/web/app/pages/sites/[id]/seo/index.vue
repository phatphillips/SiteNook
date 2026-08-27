<script setup lang="ts">
import type { OverviewDateRange } from '~/utils/overviewDateRange'
import type { Scan, SeoIssue } from '~/types/sitenook'
import { filterScansByDateRange, overviewRangeBounds } from '~/utils/overviewDateRange'
import { hydrateScanSeoIssueCounts } from '~/utils/hydrateScanSeoIssueCounts'
import { buildSeoIssueBreakdown } from '~/utils/seoIssueBreakdown'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import { scanTimestamp } from '~/utils/scanDisplay'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { activeSiteId } = useSites()
const { pb } = usePocketBase()
const {
  latestScan,
  scans,
  openIssues,
  crawlAudit,
  seoScore,
  technicalScore,
  contentScore,
  crawlabilityScore,
  crawlabilityIssues,
  avgReadabilityScore,
  loading
} = useSEO(siteId, { summary: false, parts: ['issues', 'pages'] })

const dateRange = ref<OverviewDateRange>({ preset: 30 })
const selectedCategoryId = ref<string | null>(null)
const selectedIssue = ref<SeoIssue | null>(null)
const drawerOpen = ref(false)
const hydratedScans = ref<Scan[]>([])

const rangeBounds = computed(() => overviewRangeBounds(dateRange.value))

const overviewInitialLoading = computed(
  () => loading.value && !latestScan.value
)

const technicalIssueCount = computed(() =>
  openIssues.value.filter(issue =>
    issue.category === 'technical' && issue.subcategory !== 'crawlability'
  ).length
)

const contentIssueCount = computed(() =>
  openIssues.value.filter(issue => issue.category === 'content').length
)

const breakdownRows = computed(() =>
  buildSeoIssueBreakdown({
    technical: technicalIssueCount.value,
    crawlability: crawlabilityIssues.value.length,
    content: contentIssueCount.value,
    siteId: siteId.value
  })
)

const filteredScans = computed(() =>
  filterScansByDateRange(hydratedScans.value, rangeBounds.value)
)

const completeScansInRange = computed(() =>
  filteredScans.value
    .filter(s => s.status === 'complete' || s.status === 'complete_with_errors')
    .sort((a, b) => compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b)))
)

const scoreDelta = computed((): number | null => {
  const current = completeScansInRange.value[0]
  const previous = completeScansInRange.value[1]
  if (!current || !previous) return null
  if (current.score_seo == null || previous.score_seo == null) return null
  return Math.round((current.score_seo - previous.score_seo) * 10) / 10
})

const technicalPreviewIssues = computed(() =>
  openIssues.value.filter(issue =>
    issue.category === 'technical' && issue.subcategory !== 'crawlability'
  )
)

const contentPreviewIssues = computed(() =>
  openIssues.value.filter(issue => issue.category === 'content')
)

const showTechnicalPreview = computed(() =>
  !selectedCategoryId.value || selectedCategoryId.value === 'technical'
)
const showCrawlabilityPreview = computed(() =>
  !selectedCategoryId.value || selectedCategoryId.value === 'crawlability'
)
const showContentPreview = computed(() =>
  !selectedCategoryId.value || selectedCategoryId.value === 'content'
)

function openIssue(issue: SeoIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}

watch(scans, async (next) => {
  if (!pb || !next.length) {
    hydratedScans.value = next
    return
  }
  hydratedScans.value = await hydrateScanSeoIssueCounts(pb, next)
}, { immediate: true })

onMounted(() => {
  activeSiteId.value = siteId.value
})
</script>

<template>
  <AppDashboardPanel full-width>
    <template #header>
      <DashboardPageNavbar title="SEO">
        <template #right><ScanTriggerButton :site-id="siteId" /></template>
      </DashboardPageNavbar>
    </template>
    <template #body>
      <SitePageToolbar class="mb-2" :show-site-selector="false">
        <template #trailing>
          <AccessibilityOverviewDateRangeControls v-model="dateRange" />
        </template>
      </SitePageToolbar>

      <section class="mb-6">
        <div v-if="overviewInitialLoading" class="flex justify-center py-12">
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
        </div>
        <SeoOverviewScoreSection
          v-else-if="latestScan"
          :site-id="siteId"
          :scans="filteredScans"
          :expand-scans="hydratedScans"
          :seo-score="seoScore"
          :score-delta="scoreDelta"
          :range-bounds="rangeBounds"
          :breakdown-rows="breakdownRows"
          :selected-category-id="selectedCategoryId"
          :technical-score="technicalScore"
          :crawlability-score="crawlabilityScore"
          :content-score="contentScore"
          :avg-readability-score="avgReadabilityScore"
          :preview-issues="openIssues"
          @update:selected-category-id="selectedCategoryId = $event"
        />
        <UCard
          v-else
          :ui="{ root: 'bg-elevated/25 border border-default', body: 'p-6' }"
        >
          <p class="text-center text-sm text-muted">
            Run a scan with SEO checks enabled to see SEO scores and issue breakdowns.
          </p>
        </UCard>
      </section>

      <section v-if="latestScan && !overviewInitialLoading" class="grid gap-4 xl:grid-cols-2">
        <SeoIssuesPreviewTable
          v-if="showTechnicalPreview"
          title="Top technical issues"
          :issues="technicalPreviewIssues"
          :loading="loading"
          :site-id="siteId"
          :footer-to="`/sites/${siteId}/seo/technical`"
          footer-label="View all technical issues"
          empty-label="No technical SEO issues on the latest scan."
          :class="{ 'xl:col-span-2': selectedCategoryId === 'technical' }"
          @select="openIssue"
        />
        <div
          v-if="showCrawlabilityPreview && crawlAudit"
          :class="{ 'xl:col-span-2': selectedCategoryId === 'crawlability' }"
        >
          <SeoSiteFilesPanel
            :audit="crawlAudit"
            :issues="openIssues"
            @view-issue="openIssue"
          />
        </div>
        <SeoIssuesPreviewTable
          v-if="showContentPreview"
          title="Top content issues"
          :issues="contentPreviewIssues"
          :loading="loading"
          :site-id="siteId"
          :footer-to="`/sites/${siteId}/seo/content`"
          footer-label="View all content issues"
          empty-label="No content SEO issues on the latest scan."
          :class="{ 'xl:col-span-2': selectedCategoryId === 'content' }"
          @select="openIssue"
        />
      </section>

      <SeoIssueDetailDrawer
        :issue="selectedIssue"
        :open="drawerOpen"
        :site-id="siteId"
        @update:open="drawerOpen = $event"
      />
    </template>
  </AppDashboardPanel>
</template>
