<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/sitenook'
import { isTrustedScan, pickLatestScan } from '~/utils/scanDisplay'
import { useA11yIssuesPage } from '~/composables/useA11yIssuesPage'
import { useA11yIssueActions } from '~/composables/useA11yIssueActions'
import type { DismissReason } from '~/utils/issueActions'
import { affectedPagesForRule } from '~/utils/affectedPages'
import type { A11yIssueActionEntry } from '~/utils/a11yIssueHistory'
import { issuePageRowKey, issueRowKey, waitForIssueRowExit } from '~/utils/issueRowExit'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { activeSiteId } = useSites()

const viewTab = useState<'issues' | 'pages'>('a11y-issues-view-tab', () => 'issues')
const pagesTableSearch = ref('')
const historyOpen = ref(false)
const removingKeys = ref<Set<string>>(new Set())

const {
  items,
  scans,
  loading: issuesLoading,
  error,
  openUniqueCount,
  openOccurrencesCount,
  occurrencesCount,
  total,
  page,
  perPage,
  pointsToGainByRule,
  scoreElementTotals,
  wcagLevel,
  filters,
  tableSearch,
  ruleStats,
  getAffectedPagesForRule,
  loadAffectedPagesForRule,
  isAffectedPagesLoading,
  invalidateAffectedPagesForRule,
  removeAffectedPageFromCache,
  refreshAll,
  buildQueryParams
} = useA11yIssuesPage(siteId)

const {
  issues: allIssues,
  filteredIssues,
  siteTargetIssues,
  loading: pagesLoading,
  fetchSiteData,
  ensureLoaded: ensureAccessibilityLoaded
} = useAccessibility(siteId, { eagerLoad: false })

const {
  rescanningPageUrl,
  actionBusy,
  dismissRule,
  dismissRulePage,
  dismissPage,
  markRuleFixed,
  markRulePage,
  markPageFixed,
  reopenIssues,
  rescanPage
} = useA11yIssueActions(siteId, allIssues)

const latestUntrustedScan = computed(() => {
  const latest = pickLatestScan(
    scans.value.filter(s => s.status === 'complete' || s.status === 'complete_with_errors')
  )
  if (!latest || isTrustedScan(latest)) return null
  return latest
})

const issuesFooterSummary = computed(() => {
  if (issuesLoading.value && !items.value.length) return ''

  const hasUiFilters = filters.value.wcagLevels.length > 0
    || filters.value.impacts.length > 0
    || filters.value.types.length > 0
    || filters.value.elements.length > 0
    || filters.value.roles.length > 0
    || filters.value.targetCategories.length > 0
    || (wcagLevel.value !== 'All' && !filters.value.wcagLevels.length)
    || tableSearch.value.trim().length > 0

  const start = total.value === 0 ? 0 : (page.value - 1) * perPage.value + 1
  const end = Math.min(page.value * perPage.value, total.value)

  if (hasUiFilters) {
    return `Showing ${start}-${end} of ${total.value} filtered issue types (${occurrencesCount.value} occurrences)`
  }

  return `Showing ${start}-${end} of ${openUniqueCount.value} issue types (${openOccurrencesCount.value} occurrences in site target)`
})

/** True while the Pages tab is waiting on the client accessibility payload. */
const pagesLoadPending = ref(false)
let pagesLoadGeneration = 0

async function ensurePagesDataLoaded() {
  const generation = ++pagesLoadGeneration
  pagesLoadPending.value = true
  try {
    await ensureAccessibilityLoaded()
  } catch {
    // Toast / empty state handled by the table once loading settles.
  } finally {
    if (generation === pagesLoadGeneration) pagesLoadPending.value = false
  }
}

const pagesFooterSummary = computed(() => {
  if (pagesLoading.value || pagesLoadPending.value) return ''
  const openPages = new Set(
    filteredIssues.value
      .filter(issue => issue.status === 'open' && issue.expand?.page?.url)
      .map(issue => issue.expand!.page!.url)
  )
  const label = openPages.size === 1 ? 'page with open issues' : 'pages with open issues'
  return `${openPages.size} ${label}`
})

const selectedIssue = ref<AccessibilityIssue | null>(null)
const drawerOpen = ref(false)

const selectedAffectedPages = computed(() => {
  if (!selectedIssue.value) return []
  return affectedPagesForRule(allIssues.value, selectedIssue.value.rule_id)
})

const filterMenuIssues = computed(() =>
  viewTab.value === 'pages' ? siteTargetIssues.value : items.value
)

// viewTab is useState-backed, so revisiting the page can land on "pages" without a
// tab change. Load immediately in that case (not only when switching from Issues).
watch(viewTab, (tab) => {
  if (tab === 'pages') void ensurePagesDataLoaded()
}, { immediate: true })

watch(siteId, () => {
  activeSiteId.value = siteId.value
  if (viewTab.value === 'pages') void ensurePagesDataLoaded()
})

onMounted(() => {
  activeSiteId.value = siteId.value
  const level = route.query.level as string
  if (level && ['A', 'AA', 'AAA'].includes(level)) {
    wcagLevel.value = level as typeof wcagLevel.value
    filters.value = { ...filters.value, wcagLevels: [level] }
  }
  const category = route.query.category as string
  if (category === 'aria' || category === 'best_practice') {
    filters.value = {
      ...filters.value,
      targetCategories: [category]
    }
  }
  const impact = route.query.impact as string
  if (impact && ['critical', 'serious', 'moderate', 'minor'].includes(impact)) {
    filters.value = { ...filters.value, impacts: [impact] }
  }
})

async function openFix(issue: AccessibilityIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
  await loadAffectedPagesForRule(issue.rule_id)
}

async function refreshAfterIssueAction(ruleId?: string) {
  if (ruleId) invalidateAffectedPagesForRule(ruleId)
  await ensureAccessibilityLoaded().catch(() => {})
  await Promise.all([
    refreshAll({ silent: true }),
    fetchSiteData({ silent: true })
  ])
}

function markRemoving(keys: string[]) {
  const next = new Set(removingKeys.value)
  for (const key of keys) next.add(key)
  removingKeys.value = next
}

function clearRemoving(keys: string[]) {
  const next = new Set(removingKeys.value)
  for (const key of keys) next.delete(key)
  removingKeys.value = next
}

function optimisticallyRemoveRule(ruleId: string) {
  items.value = items.value.filter(issue => issue.rule_id !== ruleId)
  if (total.value > 0) total.value -= 1
}

function optimisticallyRemoveRulePage(ruleId: string, pageUrl: string, _issueIds?: string[]) {
  const remaining = removeAffectedPageFromCache(ruleId, pageUrl)
  if (remaining === 0) {
    items.value = items.value.filter(issue => issue.rule_id !== ruleId)
    if (total.value > 0) total.value -= 1
  }
}

/** Run exit animation in parallel with the server update so feedback feels instant. */
async function runWithExitAnimation(keys: string[], action: () => Promise<unknown>, ruleId?: string) {
  markRemoving(keys)
  const results = await Promise.allSettled([
    waitForIssueRowExit(),
    action()
  ])
  const actionResult = results[1]
  if (actionResult?.status === 'rejected') {
    clearRemoving(keys)
    void refreshAfterIssueAction(ruleId)
    throw actionResult.reason
  }
  clearRemoving(keys)
  void refreshAfterIssueAction(ruleId)
}

async function onScanQueued() {
  await refreshAfterIssueAction()
}

async function onDismissRule(ruleId: string, reason: string) {
  await ensureAccessibilityLoaded()
  const key = issueRowKey(ruleId, siteId.value)
  await runWithExitAnimation([key], async () => {
    optimisticallyRemoveRule(ruleId)
    await dismissRule(ruleId, reason as DismissReason)
  }, ruleId)
}

async function onDismissRulePage(
  ruleId: string,
  pageUrl: string,
  reason: string,
  issueIds?: string[]
) {
  await ensureAccessibilityLoaded()
  const key = issuePageRowKey(ruleId, pageUrl, siteId.value)
  await runWithExitAnimation([key], async () => {
    optimisticallyRemoveRulePage(ruleId, pageUrl, issueIds)
    await dismissRulePage(ruleId, pageUrl, reason as DismissReason, issueIds)
  }, ruleId)
}

async function onDismissPage(pageUrl: string, reason: string) {
  await ensureAccessibilityLoaded()
  await dismissPage(pageUrl, reason as DismissReason)
  await refreshAfterIssueAction()
}

async function onMarkRuleFixed(ruleId: string, _siteId?: string) {
  await ensureAccessibilityLoaded()
  const key = issueRowKey(ruleId, siteId.value)
  await runWithExitAnimation([key], async () => {
    optimisticallyRemoveRule(ruleId)
    await markRuleFixed(ruleId)
  }, ruleId)
}

async function onMarkRulePage(
  ruleId: string,
  pageUrl: string,
  issueIds?: string[],
  _siteId?: string
) {
  await ensureAccessibilityLoaded()
  const key = issuePageRowKey(ruleId, pageUrl, siteId.value)
  await runWithExitAnimation([key], async () => {
    optimisticallyRemoveRulePage(ruleId, pageUrl, issueIds)
    await markRulePage(ruleId, pageUrl, issueIds)
  }, ruleId)
}

async function onMarkPageFixed(pageUrl: string) {
  await ensureAccessibilityLoaded()
  await markPageFixed(pageUrl)
  await refreshAfterIssueAction()
}

async function onRescanPage(pageUrl: string, _siteId?: string) {
  await rescanPage(pageUrl, onScanQueued)
}

async function onDrawerDismiss(reason: DismissReason) {
  if (!selectedIssue.value) return
  const ruleId = selectedIssue.value.rule_id
  try {
    await onDismissRule(ruleId, reason)
    drawerOpen.value = false
  } catch {
    // Stay open so the user can retry; toast already shown by actions composable.
  }
}

async function onDrawerMarkFixed() {
  if (!selectedIssue.value) return
  const ruleId = selectedIssue.value.rule_id
  try {
    await onMarkRuleFixed(ruleId)
    drawerOpen.value = false
  } catch {
    // Stay open so the user can retry; toast already shown by actions composable.
  }
}

async function onHistoryReopen(entry: A11yIssueActionEntry) {
  if (!entry.issue_ids?.length) return
  await reopenIssues(entry.issue_ids, {
    ruleId: entry.rule_id,
    scope: entry.scope,
    pageUrl: entry.page_url,
    pageTitle: entry.page_title,
    description: entry.description,
    impact: entry.impact,
    wcagLevel: entry.wcag_level
  })
  await refreshAfterIssueAction(entry.rule_id)
}

function onHistoryViewRule(ruleId: string) {
  viewTab.value = 'issues'
  tableSearch.value = ruleId
}

const issuesTableRef = useTemplateRef('issuesTableRef')
const pagesTableRef = useTemplateRef('pagesTableRef')

const {
  exportModalOpen: issuesExportOpen,
  exportConfig: issuesExportConfig,
  exporting: issuesExporting,
  progressMessage: issuesExportProgress,
  runExport: runIssuesExport
} = useSiteIssuesCsvExport({
  siteId,
  items,
  total,
  page,
  perPage,
  pointsToGainByRule,
  ruleStats,
  buildQueryParams,
  loadAffectedPagesForRule,
  getColumnVisibility: () => issuesTableRef.value?.getColumnVisibility?.()
})

const {
  exportModalOpen: pagesExportOpen,
  exportConfig: pagesExportConfig,
  exporting: pagesExporting,
  progressMessage: pagesExportProgress,
  runExport: runPagesExport
} = usePagesBreakdownCsvExport({
  issues: filteredIssues,
  siteId,
  getColumnVisibility: () => pagesTableRef.value?.getColumnVisibility?.()
})

const exportModalOpen = computed({
  get: () => (viewTab.value === 'issues' ? issuesExportOpen.value : pagesExportOpen.value),
  set: (value: boolean) => {
    if (viewTab.value === 'issues') issuesExportOpen.value = value
    else pagesExportOpen.value = value
  }
})

const exportConfig = computed(() =>
  viewTab.value === 'issues' ? issuesExportConfig.value : pagesExportConfig.value
)

const exporting = computed(() =>
  viewTab.value === 'issues' ? issuesExporting.value : pagesExporting.value
)

const progressMessage = computed(() =>
  viewTab.value === 'issues' ? issuesExportProgress.value : pagesExportProgress.value
)

function runExport(options: import('~/utils/tableExportScope').TableExportOptions) {
  if (viewTab.value === 'issues') void runIssuesExport(options)
  else void runPagesExport(options)
}
</script>

<template>
  <AppDashboardPanel full-width>
    <template #header>
      <DashboardPageNavbar title="Issues">
        <template #right>
          <ScanTriggerButton :site-id="siteId" @queued="onScanQueued" />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
        class="mb-4"
      />
      <UAlert
        v-if="latestUntrustedScan"
        class="mb-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Latest scan was incomplete"
        :description="latestUntrustedScan.scan_quality?.reason
          ? `${latestUntrustedScan.scan_quality.reason}. Showing last trusted results.`
          : 'Showing last trusted results.'"
      />

      <div class="space-y-4">
        <DataTableToolbar>
          <template #leading>
            <div class="flex min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2 overflow-x-auto">
              <AccessibilityIssuesViewTabs v-model="viewTab" />

              <TableSearchInput
                v-if="viewTab === 'issues'"
                v-model="tableSearch"
                placeholder="Search issues…"
                aria-label="Search issues"
              />
              <TableSearchInput
                v-else
                v-model="pagesTableSearch"
                placeholder="Search pages…"
                aria-label="Search pages"
              />

              <UDropdownMenu
                v-if="viewTab === 'issues'"
                :items="issuesTableRef?.columnMenuItems ?? []"
                :content="{ align: 'start' }"
              >
                <TableToolbarMenuButton
                  label="Columns"
                  icon="i-lucide-columns-3"
                  aria-label="Toggle column visibility"
                />
              </UDropdownMenu>
              <UDropdownMenu
                v-else
                :items="pagesTableRef?.columnMenuItems ?? []"
                :content="{ align: 'start' }"
              >
                <TableToolbarMenuButton
                  label="Columns"
                  icon="i-lucide-columns-3"
                  aria-label="Toggle column visibility"
                />
              </UDropdownMenu>

              <AccessibilityIssueFiltersMenu
                v-model="filters"
                :issues="filterMenuIssues"
              />
            </div>
          </template>
          <template #actions>
            <TableToolbarMenuButton
              label="History"
              icon="i-lucide-history"
              aria-label="History"
              @click="historyOpen = true"
            />
            <TableToolbarMenuButton
              label="Export to CSV"
              icon="i-lucide-download"
              aria-label="Export to CSV"
              @click="exportModalOpen = true"
            />
          </template>
        </DataTableToolbar>

        <TableExportModal
          v-model:open="exportModalOpen"
          :config="exportConfig"
          :exporting="exporting"
          :progress-message="progressMessage"
          @export="runExport"
        />

        <AccessibilityIssuesTable
          v-if="viewTab === 'issues'"
          ref="issuesTableRef"
          v-model:search="tableSearch"
          hide-toolbar
          server-paginated
          :loading="issuesLoading"
          :page="page"
          :page-size="perPage"
          :total="total"
          :footer-summary="issuesFooterSummary"
          :issues="items"
          :score-element-totals="scoreElementTotals"
          :points-to-gain-by-rule="pointsToGainByRule"
          :rule-stats="ruleStats"
          :get-affected-pages-for-rule="getAffectedPagesForRule"
          :load-affected-pages-for-rule="loadAffectedPagesForRule"
          :is-affected-pages-loading="isAffectedPagesLoading"
          :rescanning-page-url="rescanningPageUrl"
          :removing-keys="removingKeys"
          :site-id="siteId"
          @update:page="(p) => { page = p }"
          @open="openFix"
          @dismiss="onDismissRule"
          @dismiss-page="onDismissRulePage"
          @mark-fixed="onMarkRuleFixed"
          @mark-page-fixed="onMarkRulePage"
          @rescan-page="onRescanPage"
        />

        <AccessibilityPagesBreakdownTable
          v-else
          ref="pagesTableRef"
          v-model:search="pagesTableSearch"
          hide-toolbar
          :loading="pagesLoading || pagesLoadPending"
          :issues="filteredIssues"
          :footer-summary="pagesFooterSummary"
          :site-id="siteId"
          @open-issue="openFix"
          @dismiss="onDismissPage"
          @mark-fixed="onMarkPageFixed"
          @rescan="onRescanPage"
        />
      </div>

      <AccessibilityIssueDetailDrawer
        :issue="selectedIssue"
        :affected-pages="selectedAffectedPages"
        :open="drawerOpen"
        :site-id="siteId"
        :scans="scans"
        :busy="actionBusy"
        :on-refresh="onScanQueued"
        :on-dismiss-issue="onDrawerDismiss"
        :on-mark-issue-fixed="onDrawerMarkFixed"
        @update:open="drawerOpen = $event"
      />

      <AccessibilityIssueHistoryDrawer
        v-model:open="historyOpen"
        :site-id="siteId"
        :on-reopen="onHistoryReopen"
        @view-rule="onHistoryViewRule"
      />
    </template>
  </AppDashboardPanel>
</template>
