<script setup lang="ts">
import type { Site } from '~/types/sitenook'
import type { OverviewDateRange } from '~/utils/overviewDateRange'
import { filterScansByDateRange, overviewRangeBounds } from '~/utils/overviewDateRange'
import { buildQaIssueBreakdown } from '~/utils/qaIssueBreakdown'
import { siteSettingsForSite } from '~/utils/siteSettings'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import { scanTimestamp } from '~/utils/scanDisplay'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { sites, refreshSite } = useSites()
const showSettingsModal = ref(false)
const settingsSite = ref<Site | null>(null)

const {
  scans,
  brokenLinkCount,
  misspellingCount,
  policyMatchCount,
  avgReadability,
  wordsToReviewCount,
  inventoryCount,
  internalBrokenLinkCount,
  externalBrokenLinkCount,
  previewBrokenLinks,
  previewSpelling,
  previewPolicyMatches,
  latestScan,
  loading
} = useQA(siteId, { overview: true })

const dateRange = ref<OverviewDateRange>({ preset: 30 })
const selectedCategoryId = ref<string | null>(null)

const siteSettings = computed(() =>
  siteSettingsForSite(sites.value.find(s => s.id === siteId.value))
)

const qaScore = computed(() => latestScan.value?.score_qa ?? null)
const rangeBounds = computed(() => overviewRangeBounds(dateRange.value))

const overviewInitialLoading = computed(
  () => loading.value && !latestScan.value
)

const breakdownRows = computed(() =>
  buildQaIssueBreakdown({
    brokenLinks: brokenLinkCount.value,
    misspellings: misspellingCount.value,
    wordsToReview: wordsToReviewCount.value,
    policies: policyMatchCount.value,
    inventory: inventoryCount.value,
    siteId: siteId.value
  })
)

const filteredScans = computed(() =>
  filterScansByDateRange(scans.value, rangeBounds.value)
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
  if (current.score_qa == null || previous.score_qa == null) return null
  return Math.round((current.score_qa - previous.score_qa) * 10) / 10
})

const showBrokenLinksPreview = computed(() =>
  !selectedCategoryId.value || selectedCategoryId.value === 'broken_links'
)
const showSpellingPreview = computed(() =>
  !selectedCategoryId.value
    || selectedCategoryId.value === 'misspellings'
    || selectedCategoryId.value === 'words_to_review'
)
const showPoliciesPreview = computed(() =>
  !selectedCategoryId.value || selectedCategoryId.value === 'policies'
)

async function openSiteSettings() {
  const site = sites.value.find(s => s.id === siteId.value)
  if (!site) return
  settingsSite.value = site
  await nextTick()
  showSettingsModal.value = true
}

async function onSettingsSaved() {
  await refreshSite(siteId.value)
  settingsSite.value = sites.value.find(s => s.id === siteId.value) ?? settingsSite.value
}
</script>

<template>
  <AppDashboardPanel full-width>
    <template #header>
      <DashboardPageNavbar title="Quality Assurance">
        <template #right><ScanTriggerButton :site-id="siteId" /></template>
      </DashboardPageNavbar>
    </template>
    <template #body>
      <SitePageToolbar class="mb-2" :show-site-selector="false">
        <QaTargetBadgeRow :settings="siteSettings" @edit="openSiteSettings" />
        <template #trailing>
          <AccessibilityOverviewDateRangeControls v-model="dateRange" />
        </template>
      </SitePageToolbar>

      <section class="mb-6">
        <QaOverviewScoreSectionSkeleton v-if="overviewInitialLoading" />
        <QaOverviewScoreSection
          v-else-if="latestScan"
          :site-id="siteId"
          :scans="filteredScans"
          :expand-scans="scans"
          :qa-score="qaScore"
          :score-delta="scoreDelta"
          :range-bounds="rangeBounds"
          :breakdown-rows="breakdownRows"
          :selected-category-id="selectedCategoryId"
          :preview-broken-links="previewBrokenLinks"
          :preview-spelling="previewSpelling"
          :preview-policy-matches="previewPolicyMatches"
          :internal-broken-link-count="internalBrokenLinkCount"
          :external-broken-link-count="externalBrokenLinkCount"
          :words-to-review-count="wordsToReviewCount"
          :avg-readability="avgReadability"
          @update:selected-category-id="selectedCategoryId = $event"
        />
        <UCard
          v-else
          :ui="{ root: 'bg-elevated/25 border border-default', body: 'p-6' }"
        >
          <p class="text-sm text-muted text-center">
            Run a scan with quality checks enabled to see QA scores and issue breakdowns.
          </p>
        </UCard>
      </section>

      <section v-if="latestScan && !overviewInitialLoading" class="grid gap-4 xl:grid-cols-2">
        <QaBrokenLinksPreviewTable
          v-if="showBrokenLinksPreview"
          :links="previewBrokenLinks"
          :loading="loading"
          :site-id="siteId"
        />
        <QaSpellingPreviewTable
          v-if="showSpellingPreview"
          :items="previewSpelling"
          :loading="loading"
          :site-id="siteId"
        />
        <QaPolicyMatchesPreviewTable
          v-if="showPoliciesPreview"
          :items="previewPolicyMatches"
          :loading="loading"
          :site-id="siteId"
          :class="{ 'xl:col-span-2': selectedCategoryId === 'policies' }"
        />
      </section>

      <SiteSettingsModal
        v-model:open="showSettingsModal"
        :site="settingsSite"
        @saved="onSettingsSaved"
      />
    </template>
  </AppDashboardPanel>
</template>
