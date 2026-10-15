<script setup lang="ts">
import type { OverviewDateRange } from '~/utils/overviewDateRange'
import type { Scan, SeoIssue } from '~/types/sitenook'
import { filterScansByDateRange, overviewRangeBounds } from '~/utils/overviewDateRange'
import { hydrateScanSeoIssueCounts } from '~/utils/hydrateScanSeoIssueCounts'
import { buildSeoIssueBreakdown } from '~/utils/seoIssueBreakdown'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import { scanTimestamp } from '~/utils/scanDisplay'

const props = withDefaults(defineProps<{
  siteId: string
  syncActiveSite?: boolean
  /** When false, hide date-range toolbar (main dashboard embeds). */
  showToolbar?: boolean
}>(), {
  syncActiveSite: true,
  showToolbar: true
})

const siteIdRef = computed(() => props.siteId)
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
} = useSEO(siteIdRef, { summary: false, parts: ['issues', 'pages'] })

const dateRange = defineModel<OverviewDateRange>('dateRange', {
  default: () => ({ preset: 30 as const })
})
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
    siteId: props.siteId
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
  if (props.syncActiveSite) {
    activeSiteId.value = props.siteId
  }
})
</script>

<template>
  <div>
    <SitePageToolbar v-if="showToolbar" class="mb-2" :show-site-selector="false">
      <template #trailing>
        <AccessibilityOverviewDateRangeControls v-model="dateRange" />
      </template>
    </SitePageToolbar>

    <section>
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
        :technical-score="technicalScore"
        :crawlability-score="crawlabilityScore"
        :content-score="contentScore"
        :avg-readability-score="avgReadabilityScore"
        :preview-issues="openIssues"
        :crawl-audit="crawlAudit"
        @view-issue="openIssue"
      />
      <UCard
        v-else
        :ui="{ root: 'bg-elevated border border-default', body: 'p-6' }"
      >
        <p class="text-center text-sm text-muted">
          Run a scan with SEO checks enabled to see SEO scores and issue breakdowns.
        </p>
      </UCard>
    </section>

    <SeoIssueDetailDrawer
      :issue="selectedIssue"
      :open="drawerOpen"
      :site-id="siteId"
      @update:open="drawerOpen = $event"
    />
  </div>
</template>
