<script setup lang="ts">
import type { AccessibilityIssue, Site } from '~/types/accessiq'
import type { OverviewDateRange } from '~/utils/overviewDateRange'
import {
  filterScansByDateRange,
  overviewRangeBounds
} from '~/utils/overviewDateRange'
import { affectedPagesForRule } from '~/utils/affectedPages'
import {
  buildUrlsByRule,
  sortOpenByPointsToGain,
  uniqueByRule
} from '~/utils/accessibilityIssues'
import { calculateAccessibilityScores } from '~/composables/useAccessibility'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import { pickLatestScan, scanTimestamp } from '~/utils/scanDisplay'
import {
  hasMeaningfulStoredOverall,
  preferStoredScanScore,
  resolveBestPracticeScore
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
  pagesWithIssuesByScan,
  loading,
  overallScore,
  siteSettings,
  scoreableTargetIssues,
  scoreElementTotals,
  pointsToGainByRule,
  fetchSiteData
} = useAccessibility(siteId)

const dateRange = ref<OverviewDateRange>({ preset: 30 })

const rangeBounds = computed(() => overviewRangeBounds(dateRange.value))

const filteredScans = computed(() =>
  filterScansByDateRange(scans.value, rangeBounds.value)
)

const scanIdsInRange = computed(() => new Set(filteredScans.value.map(s => s.id)))

const latestScanInRange = computed(() =>
  pickLatestScan(
    filteredScans.value.filter(
      s => s.status === 'complete' || s.status === 'complete_with_errors'
    )
  )
)

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

const liveScoresForLatestScan = computed(() => {
  const issues = latestScanScoringIssues.value
  if (!issues.length) return null
  return calculateAccessibilityScores(issues, latestScanDenominators.value)
})

const displayOverallScore = computed(() => {
  const scan = latestScanInRange.value
  const live = liveScoresForLatestScan.value?.overall ?? overallScore.value
  return preferStoredScanScore(scan?.score_overall, live)
})

const completeScansInRange = computed(() =>
  filteredScans.value
    .filter(s => s.status === 'complete' || s.status === 'complete_with_errors')
    .sort((a, b) => compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b)))
)

function liveCategoryScoresForScan(
  issues: AccessibilityIssue[],
  denominators: ElementTotals | null | undefined
): TargetCategoryScores {
  if (!issues.length) {
    return calculateTargetCategoryScores([], denominators)
  }
  return calculateTargetCategoryScores(toScoreIssues(issues), denominators)
}

const categoryScoresForLatestScan = computed((): TargetCategoryScores => {
  const scan = latestScanInRange.value
  const issues = latestScanScoringIssues.value
  const denominators = latestScanDenominators.value
  const live = liveCategoryScoresForScan(issues, denominators)

  if (!scan) return live

  return {
    levelA: preferStoredScanScore(scan.score_a, live.levelA),
    levelAA: preferStoredScanScore(scan.score_aa, live.levelAA),
    levelAAA: preferStoredScanScore(scan.score_aaa, live.levelAAA),
    aria: live.aria,
    bestPractice: resolveBestPracticeScore(scan, live.bestPractice)
  }
})

const scoreDelta = computed((): number | null => {
  const ordered = completeScansInRange.value
  const current = ordered[0] ?? null
  const previous = ordered[1] ?? null
  if (!current || !previous) return null

  // Compare stored overall only — do not fall back to live for bugged zero baselines.
  if (!hasMeaningfulStoredOverall(current) || !hasMeaningfulStoredOverall(previous)) {
    return null
  }

  const delta = current.score_overall! - previous.score_overall!
  return Math.round(delta * 10) / 10
})

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

const openIssuesForScoring = computed(() =>
  issuesInRange.value.filter(i => i.status === 'open')
)

const openUrlsByRule = computed(() =>
  buildUrlsByRule(issuesInRange.value, ['open'])
)

const previewOpenIssues = computed(() => {
  const unique = uniqueByRule(openIssuesForScoring.value)
  return sortOpenByPointsToGain(unique, openIssuesForScoring.value).slice(0, 5)
})

const selectedAffectedPages = computed(() => {
  if (!selectedIssue.value) return []
  return affectedPagesForRule(issuesInRange.value, selectedIssue.value.rule_id)
})

const latestScanOpenIssues = computed(() => {
  const scan = latestScanInRange.value
  if (!scan) return []
  return issuesInRange.value.filter(i => i.scan === scan.id && i.status === 'open')
})
const issuesPageLink = computed(() => `/sites/${siteId.value}/accessibility/issues`)

const overviewOpenColumnVisibility = {
  issue: true,
  impact: true,
  pointsToGain: true,
  wcag_level: false,
  pages: false,
  occurrences: false
}

onMounted(() => {
  activeSiteId.value = siteId.value
  if (route.query.scan) {
    const { scan: _scan, ...query } = route.query
    navigateTo({ path: route.path, query }, { replace: true })
  }
})

function openPreview(issue: AccessibilityIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Accessibility">
        <template #right>
          <ScanTriggerButton :site-id="siteId" @queued="fetchSiteData" />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <SitePageToolbar class="mb-2">
        <SiteTargetBadgeRow :settings="siteSettings" @edit="openSiteSettings" />
        <template #trailing>
          <AccessibilityOverviewDateRangeControls v-model="dateRange" />
        </template>
      </SitePageToolbar>

      <div v-if="loading" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
      </div>

      <template v-else>
        <section class="mb-6">
          <ScanStatusSummaryCard
            :scan="latestScanInRange"
            title="Accessibility Data Source"
          />
        </section>

        <section class="mb-6">
          <AccessibilityOverviewScoreSection
            :settings="siteSettings"
            :category-scores="categoryScoresForLatestScan"
            :overall-score="displayOverallScore"
            :score-delta="scoreDelta"
            :site-id="siteId"
            :latest-scan-issues="latestScanOpenIssues"
            :scoring-issues="latestScanScoringIssues"
            :score-element-totals="latestScanDenominators"
            :scans="filteredScans"
            :pages-with-issues-by-scan="pagesWithIssuesByScan"
            :range-bounds="rangeBounds"
          />
        </section>

        <section class="min-w-0">
          <AccessibilityIssuesTable
            v-if="previewOpenIssues.length"
            table-title="Open issues"
            :default-column-visibility="overviewOpenColumnVisibility"
            :issues="previewOpenIssues"
            :scoring-issues="scoringIssuesInRange"
            :score-element-totals="scoreElementTotals"
            :points-to-gain-by-rule="pointsToGainByRule"
            :pages-by-rule="openUrlsByRule"
            :site-id="siteId"
            read-only
            hide-toolbar
            :page-size="5"
            :footer-link="{ to: issuesPageLink, label: 'View all issues' }"
            @open="openPreview"
          />
          <p v-else class="text-sm text-muted py-4">
            No open issues in this period.
          </p>
        </section>
      </template>

      <AccessibilityIssueDetailDrawer
        :issue="selectedIssue"
        :affected-pages="selectedAffectedPages"
        :open="drawerOpen"
        :site-id="siteId"
        :scans="scans"
        :on-refresh="() => fetchSiteData({ silent: true })"
        read-only
        @update:open="drawerOpen = $event"
      />

      <SiteSettingsModal
        v-model:open="showSettingsModal"
        :site="settingsSite"
        @saved="onSettingsSaved"
      />
    </template>
  </AppDashboardPanel>
</template>
