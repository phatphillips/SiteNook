<script setup lang="ts">
import type { AccessibilityIssue, Site } from '~/types/sitenook'
import type { OverviewDateRange } from '~/utils/overviewDateRange'
import {
  filterScansByDateRange,
  overviewRangeBounds
} from '~/utils/overviewDateRange'
import { affectedPagesForRule } from '~/utils/affectedPages'
import { calculateAccessibilityScores } from '~/composables/useAccessibility'
import { isTrustedScan, pickLatestScan, pickLatestTrustedScan } from '~/utils/scanDisplay'
import {
  preferLiveScanScore
} from '~/utils/scanScores'
import {
  calculateTargetCategoryScores,
  type ElementTotals,
  type SiteimproveScoreIssue,
  type TargetCategoryScores
} from '~/utils/siteimproveScore'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { activeSiteId, sites, refreshSite } = useSites()
const showSettingsModal = ref(false)
const settingsSite = ref<Site | null>(null)

const {
  issues,
  scans,
  loading,
  overallScore,
  siteSettings,
  scoreableTargetIssues,
  scoreElementTotals,
  scoringCheckStats,
  fetchSiteData
} = useAccessibility(siteId)

const dateRange = ref<OverviewDateRange>({ preset: 30 })

const rangeBounds = computed(() => overviewRangeBounds(dateRange.value))

const filteredScans = computed(() =>
  filterScansByDateRange(scans.value, rangeBounds.value)
)

const scanIdsInRange = computed(() => new Set(filteredScans.value.map(s => s.id)))

const completedScansInRange = computed(() =>
  filteredScans.value.filter(
    s => s.status === 'complete' || s.status === 'complete_with_errors'
  )
)

const latestScanInRange = computed(() => pickLatestTrustedScan(completedScansInRange.value))

const latestUntrustedScan = computed(() => {
  const latest = pickLatestScan(completedScansInRange.value)
  if (!latest || isTrustedScan(latest)) return null
  return latest
})

const issuesInRange = computed(() =>
  issues.value.filter(issue => scanIdsInRange.value.has(issue.scan))
)

const scoringIssuesInRange = computed(() =>
  scoreableTargetIssues.value.filter(issue => scanIdsInRange.value.has(issue.scan))
)

function toScoreIssues(issues: AccessibilityIssue[]): SiteimproveScoreIssue[] {
  return issues.map(issue => ({
    rule_id: issue.rule_id,
    wcag_level: issue.wcag_level,
    element_type: issue.element_type,
    status: issue.status
  }))
}

const latestScanScoringIssues = computed(() => {
  const scan = latestScanInRange.value
  if (!scan) return []
  return scoringIssuesInRange.value.filter(issue => issue.scan === scan.id)
})

const latestScanDenominators = computed(() => {
  const scan = latestScanInRange.value
  return scan?.score_denominators?.elements ?? scoreElementTotals.value
})

const latestScanCheckStats = computed(() =>
  latestScanInRange.value?.a11y_check_stats ?? scoringCheckStats.value
)

const liveScoresForLatestScan = computed(() => {
  const scan = latestScanInRange.value
  if (!scan) return null
  // Empty set is a valid perfect score after all issues are fixed/dismissed.
  return calculateAccessibilityScores(
    latestScanScoringIssues.value,
    latestScanDenominators.value,
    latestScanCheckStats.value
  )
})

const displayOverallScore = computed(() => {
  const scan = latestScanInRange.value
  const live = liveScoresForLatestScan.value?.overall ?? overallScore.value
  return preferLiveScanScore(live, scan?.score_overall)
})

function liveCategoryScoresForScan(
  issues: AccessibilityIssue[],
  denominators: ElementTotals | null | undefined
): TargetCategoryScores {
  if (!issues.length) {
    return calculateTargetCategoryScores([], denominators, latestScanCheckStats.value)
  }
  return calculateTargetCategoryScores(toScoreIssues(issues), denominators, latestScanCheckStats.value)
}

const categoryScoresForLatestScan = computed((): TargetCategoryScores => {
  // Live scores reflect fixed/dismissed statuses immediately (stored scan scores do not).
  return liveCategoryScoresForScan(latestScanScoringIssues.value, latestScanDenominators.value)
})

const { isScoreRefreshing } = useA11yScoreRefresh()
const scoreUpdating = isScoreRefreshing(siteId)

async function openSiteSettings() {
  const site = sites.value.find(s => s.id === siteId.value)
  if (!site) return
  settingsSite.value = site
  await nextTick()
  showSettingsModal.value = true
}

async function onSettingsSaved() {
  await refreshSite(siteId.value)
  await fetchSiteData({ silent: true })
  settingsSite.value = sites.value.find(s => s.id === siteId.value) ?? settingsSite.value
}

const selectedIssue = ref<AccessibilityIssue | null>(null)
const drawerOpen = ref(false)
const drawerReadOnly = ref(true)

const selectedAffectedPages = computed(() => {
  if (!selectedIssue.value) return []
  return affectedPagesForRule(issuesInRange.value, selectedIssue.value.rule_id)
})

const latestScanOpenIssues = computed(() => {
  const scan = latestScanInRange.value
  if (!scan) return []
  return issuesInRange.value.filter(i => i.scan === scan.id && i.status === 'open')
})

onMounted(() => {
  activeSiteId.value = siteId.value
  if (route.query.scan) {
    const { scan: _scan, ...query } = route.query
    navigateTo({ path: route.path, query }, { replace: true })
  }
})

function openPreview(issue: AccessibilityIssue, options?: { actionable?: boolean }) {
  drawerReadOnly.value = !options?.actionable
  selectedIssue.value = issue
  drawerOpen.value = true
}
</script>

<template>
  <AppDashboardPanel full-width hide-feature-banner>
    <template #header>
      <DashboardPageNavbar title="Accessibility">
        <template #right>
          <ScanTriggerButton :site-id="siteId" @queued="fetchSiteData" />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-[1200px]">
        <SitePageToolbar class="mb-3" :show-site-selector="false">
          <SiteTargetBadgeRow :settings="siteSettings" @edit="openSiteSettings" />
          <template #trailing>
            <AccessibilityOverviewDateRangeControls v-model="dateRange" />
          </template>
        </SitePageToolbar>

        <div v-if="loading" class="flex justify-center py-12">
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
        </div>

        <template v-else>
          <UAlert
            v-if="latestUntrustedScan"
            class="mb-4"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Latest scan was incomplete"
            :description="latestUntrustedScan.scan_quality?.reason
              ? `${latestUntrustedScan.scan_quality.reason}. Showing last trusted results. A verification scan is scheduled.`
              : 'Showing last trusted results. A verification scan is scheduled.'"
          />
          <section class="scroll-mt-6">
            <AccessibilityOverviewScoreSection
              :settings="siteSettings"
              :category-scores="categoryScoresForLatestScan"
              :overall-score="displayOverallScore"
              :score-updating="scoreUpdating"
              :site-id="siteId"
              :latest-scan-issues="latestScanOpenIssues"
              :scoring-issues="latestScanScoringIssues"
              :score-element-totals="latestScanDenominators"
              :check-stats="latestScanCheckStats"
              :scans="filteredScans"
              :expand-scans="scans"
              :range-bounds="rangeBounds"
              @open-issue="openPreview($event, { actionable: true })"
            />
          </section>
        </template>

        <AccessibilityIssueDetailDrawer
          :issue="selectedIssue"
          :affected-pages="selectedAffectedPages"
          :open="drawerOpen"
          :site-id="siteId"
          :scans="scans"
          :read-only="drawerReadOnly"
          :on-refresh="() => fetchSiteData({ silent: true })"
          @update:open="drawerOpen = $event"
        />

        <SiteSettingsModal
          v-model:open="showSettingsModal"
          :site="settingsSite"
          @saved="onSettingsSaved"
        />
      </div>
    </template>
  </AppDashboardPanel>
</template>
