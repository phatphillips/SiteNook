<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/sitenook'
import type { OrgAccessibilityIssueRow } from '~/composables/useOrgAccessibilityIssues'
import type { DismissReason } from '~/utils/issueActions'
import type { A11yIssueActionEntry } from '~/utils/a11yIssueHistory'
import { issuePageRowKey, issueRowKey, waitForIssueRowExit } from '~/utils/issueRowExit'

definePageMeta({ middleware: 'auth' })

const {
  items,
  loading,
  error,
  total,
  page,
  perPage,
  filters,
  tableSearch,
  openUniqueCount,
  openOccurrencesCount,
  occurrencesCount,
  pointsToGainByRule,
  ruleStats,
  wcagLevel,
  isAllSites,
  fetchIssues,
  getAffectedPagesForRule,
  loadAffectedPagesForRule,
  isAffectedPagesLoading,
  invalidateAffectedPagesForRule,
  buildQueryParams
} = useOrgA11yIssuesPage()

const {
  rescanningPageUrl,
  actionBusy,
  dismissRule,
  dismissRulePage,
  markRuleFixed,
  markRulePage,
  reopenIssues,
  rescanPage
} = useOrgA11yIssueActions({
  onRefresh: () => fetchIssues({ silent: true }),
  loadAffectedPagesForRule
})

const selectedIssue = ref<AccessibilityIssue | null>(null)
const drawerOpen = ref(false)
const historyOpen = ref(false)
const removingKeys = ref<Set<string>>(new Set())
const issuesTableRef = useTemplateRef('issuesTableRef')

const exportScopeLabel = computed(() => isAllSites.value ? 'org' : 'site')

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useIssuesCsvExport({
  items,
  total,
  page,
  perPage,
  pointsToGainByRule,
  ruleStats,
  showSiteColumn: computed(() => isAllSites.value),
  buildQueryParams,
  loadAffectedPagesForRule,
  getAffectedPagesForRule,
  scopeLabel: exportScopeLabel,
  getColumnVisibility: () => issuesTableRef.value?.getColumnVisibility?.()
})

function issueSiteId(issue: AccessibilityIssue | null): string | undefined {
  return issue ? (issue as OrgAccessibilityIssueRow).siteId : undefined
}

const selectedAffectedPages = computed(() => {
  if (!selectedIssue.value) return []
  const siteId = issueSiteId(selectedIssue.value)
  if (!siteId) return []
  return getAffectedPagesForRule(selectedIssue.value.rule_id, siteId)
})

const issuesFooterSummary = computed(() => {
  if (loading.value && !items.value.length) return ''

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

  const scope = isAllSites.value ? 'across all sites' : 'in site target'
  return `Showing ${start}-${end} of ${openUniqueCount.value} issue types (${openOccurrencesCount.value} occurrences ${scope})`
})

async function refreshAfterIssueAction(ruleId?: string, siteId?: string) {
  if (ruleId && siteId) invalidateAffectedPagesForRule(ruleId, siteId)
  await fetchIssues({ silent: true })
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

function optimisticallyRemoveRule(ruleId: string, siteId: string) {
  items.value = items.value.filter((issue) => {
    const row = issue as OrgAccessibilityIssueRow
    return !(row.rule_id === ruleId && row.siteId === siteId)
  })
  if (total.value > 0) total.value -= 1
}

async function runWithExitAnimation(
  keys: string[],
  action: () => Promise<unknown>,
  ruleId?: string,
  siteId?: string
) {
  markRemoving(keys)
  const results = await Promise.allSettled([
    waitForIssueRowExit(),
    action()
  ])
  const actionResult = results[1]
  if (actionResult?.status === 'rejected') {
    clearRemoving(keys)
    void refreshAfterIssueAction(ruleId, siteId)
    throw actionResult.reason
  }
  clearRemoving(keys)
  void refreshAfterIssueAction(ruleId, siteId)
}

async function openIssue(issue: AccessibilityIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
  const siteId = issueSiteId(issue)
  if (siteId && issue.rule_id) {
    await loadAffectedPagesForRule(issue.rule_id, siteId)
  }
}

async function onDismissRule(ruleId: string, reason: string, siteId?: string) {
  if (!siteId) return
  const sample = items.value.find(
    issue => issue.rule_id === ruleId && (issue as OrgAccessibilityIssueRow).siteId === siteId
  )
  const key = issueRowKey(ruleId, siteId)
  await runWithExitAnimation([key], async () => {
    optimisticallyRemoveRule(ruleId, siteId)
    await dismissRule(siteId, ruleId, reason as DismissReason, {
      description: sample?.description,
      impact: sample?.impact,
      wcagLevel: sample?.wcag_level
    })
  }, ruleId, siteId)
}

async function onDismissRulePage(
  ruleId: string,
  pageUrl: string,
  reason: string,
  issueIds?: string[],
  siteId?: string
) {
  if (!siteId) return
  const key = issuePageRowKey(ruleId, pageUrl, siteId)
  await runWithExitAnimation([key], async () => {
    await dismissRulePage(siteId, ruleId, pageUrl, reason as DismissReason, issueIds)
  }, ruleId, siteId)
}

async function onMarkRuleFixed(ruleId: string, siteId?: string) {
  if (!siteId) return
  const sample = items.value.find(
    issue => issue.rule_id === ruleId && (issue as OrgAccessibilityIssueRow).siteId === siteId
  )
  const key = issueRowKey(ruleId, siteId)
  await runWithExitAnimation([key], async () => {
    optimisticallyRemoveRule(ruleId, siteId)
    await markRuleFixed(siteId, ruleId, {
      description: sample?.description,
      impact: sample?.impact,
      wcagLevel: sample?.wcag_level
    })
  }, ruleId, siteId)
}

async function onMarkRulePage(
  ruleId: string,
  pageUrl: string,
  issueIds?: string[],
  siteId?: string
) {
  if (!siteId) return
  const key = issuePageRowKey(ruleId, pageUrl, siteId)
  await runWithExitAnimation([key], async () => {
    await markRulePage(siteId, ruleId, pageUrl, issueIds)
  }, ruleId, siteId)
}

async function onRescanPage(pageUrl: string, siteId?: string) {
  if (!siteId) return
  await rescanPage(siteId, pageUrl)
  await refreshAfterIssueAction()
}

async function onDrawerDismiss(reason: DismissReason) {
  const issue = selectedIssue.value
  if (!issue) return
  const siteId = issueSiteId(issue)
  if (!siteId) return
  try {
    await onDismissRule(issue.rule_id, reason, siteId)
    drawerOpen.value = false
  } catch {
    // Stay open so the user can retry.
  }
}

async function onDrawerMarkFixed() {
  const issue = selectedIssue.value
  if (!issue) return
  const siteId = issueSiteId(issue)
  if (!siteId) return
  try {
    await onMarkRuleFixed(issue.rule_id, siteId)
    drawerOpen.value = false
  } catch {
    // Stay open so the user can retry.
  }
}

async function onHistoryReopen(entry: A11yIssueActionEntry) {
  if (!entry.issue_ids?.length || !entry.site) return
  await reopenIssues(entry.site, entry.issue_ids, {
    ruleId: entry.rule_id,
    scope: entry.scope,
    pageUrl: entry.page_url,
    pageTitle: entry.page_title,
    description: entry.description,
    impact: entry.impact,
    wcagLevel: entry.wcag_level
  })
  await refreshAfterIssueAction(entry.rule_id, entry.site)
}

function onHistoryViewRule(ruleId: string) {
  tableSearch.value = ruleId
}
</script>

<template>
  <OrgFeaturePageShell
    title="Accessibility Issues"
    full-width
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
      class="mb-4"
    />

    <div class="space-y-4">
      <DataTableToolbar>
        <template #leading>
          <div class="flex min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2">
            <TableSearchInput
              v-model="tableSearch"
              placeholder="Search issues…"
              aria-label="Search issues"
            />
            <UDropdownMenu
              :items="issuesTableRef?.columnMenuItems ?? []"
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
              :issues="items"
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
        ref="issuesTableRef"
        v-model:search="tableSearch"
        hide-toolbar
        server-paginated
        :loading="loading"
        :page="page"
        :page-size="perPage"
        :total="total"
        :footer-summary="issuesFooterSummary"
        :issues="items"
        :points-to-gain-by-rule="pointsToGainByRule"
        :rule-stats="ruleStats"
        :get-affected-pages-for-rule="getAffectedPagesForRule"
        :load-affected-pages-for-rule="loadAffectedPagesForRule"
        :is-affected-pages-loading="isAffectedPagesLoading"
        :rescanning-page-url="rescanningPageUrl"
        :removing-keys="removingKeys"
        :show-site-column="isAllSites"
        @update:page="(p) => { page = p }"
        @open="openIssue"
        @dismiss="onDismissRule"
        @dismiss-page="onDismissRulePage"
        @mark-fixed="onMarkRuleFixed"
        @mark-page-fixed="onMarkRulePage"
        @rescan-page="onRescanPage"
      />
    </div>

    <AccessibilityIssueDetailDrawer
      :issue="selectedIssue"
      :affected-pages="selectedAffectedPages"
      :open="drawerOpen"
      :site-id="issueSiteId(selectedIssue)"
      :busy="actionBusy"
      :on-dismiss-issue="onDrawerDismiss"
      :on-mark-issue-fixed="onDrawerMarkFixed"
      @update:open="drawerOpen = $event"
    />

    <AccessibilityIssueHistoryDrawer
      v-model:open="historyOpen"
      :show-site-name="isAllSites"
      :on-reopen="onHistoryReopen"
      @view-rule="onHistoryViewRule"
    />
  </OrgFeaturePageShell>
</template>
