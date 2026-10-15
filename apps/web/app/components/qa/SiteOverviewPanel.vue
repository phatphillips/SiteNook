<script setup lang="ts">
import type { Site } from '~/types/sitenook'
import type { OverviewDateRange } from '~/utils/overviewDateRange'
import { filterScansByDateRange, overviewRangeBounds } from '~/utils/overviewDateRange'
import { buildQaIssueBreakdown } from '~/utils/qaIssueBreakdown'
import { siteSettingsForSite } from '~/utils/siteSettings'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import { scanTimestamp } from '~/utils/scanDisplay'

const props = withDefaults(defineProps<{
  siteId: string
  /** When false, hide site-target / date-range toolbar (main dashboard embeds). */
  showToolbar?: boolean
}>(), {
  showToolbar: true
})

const siteIdRef = computed(() => props.siteId)
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
} = useQA(siteIdRef, { overview: true })

const dateRange = defineModel<OverviewDateRange>('dateRange', {
  default: () => ({ preset: 30 as const })
})

const siteSettings = computed(() =>
  siteSettingsForSite(sites.value.find(s => s.id === props.siteId))
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
    siteId: props.siteId
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

async function openSiteSettings() {
  const site = sites.value.find(s => s.id === props.siteId)
  if (!site) return
  settingsSite.value = site
  await nextTick()
  showSettingsModal.value = true
}

async function onSettingsSaved() {
  await refreshSite(props.siteId)
  settingsSite.value = sites.value.find(s => s.id === props.siteId) ?? settingsSite.value
}
</script>

<template>
  <div>
    <SitePageToolbar v-if="showToolbar" class="mb-2" :show-site-selector="false">
      <QaTargetBadgeRow :settings="siteSettings" @edit="openSiteSettings" />
      <template #trailing>
        <AccessibilityOverviewDateRangeControls v-model="dateRange" />
      </template>
    </SitePageToolbar>

    <section>
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
        :preview-broken-links="previewBrokenLinks"
        :preview-spelling="previewSpelling"
        :preview-policy-matches="previewPolicyMatches"
        :internal-broken-link-count="internalBrokenLinkCount"
        :external-broken-link-count="externalBrokenLinkCount"
        :words-to-review-count="wordsToReviewCount"
        :avg-readability="avgReadability"
      />
      <UCard
        v-else
        :ui="{ root: 'bg-elevated border border-default', body: 'p-6' }"
      >
        <p class="text-sm text-muted text-center">
          Run a scan with quality checks enabled to see QA scores and issue breakdowns.
        </p>
      </UCard>
    </section>

    <SiteSettingsModal
      v-model:open="showSettingsModal"
      :site="settingsSite"
      @saved="onSettingsSaved"
    />
  </div>
</template>
