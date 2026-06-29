<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/accessiq'
import { useA11yIssuesPage } from '~/composables/useA11yIssuesPage'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { activeSiteId } = useSites()

const {
  items,
  scans,
  loading,
  error,
  openUniqueCount,
  openOccurrencesCount,
  occurrencesCount,
  total,
  pointsToGainByRule,
  scoreElementTotals,
  wcagLevel,
  filters,
  tableSearch,
  ruleStats,
  getAffectedPagesForRule,
  loadAffectedPagesForRule,
  refreshAll
} = useA11yIssuesPage(siteId)

const issuesFooterSummary = computed(() => {
  const hasUiFilters = filters.value.wcagLevels.length > 0
    || filters.value.impacts.length > 0
    || filters.value.types.length > 0
    || filters.value.elements.length > 0
    || filters.value.roles.length > 0
    || filters.value.targetCategories.length > 0
    || (wcagLevel.value !== 'All' && !filters.value.wcagLevels.length)
    || tableSearch.value.trim().length > 0

  if (hasUiFilters) {
    return `Showing ${items.value.length} of ${total.value} filtered issue types (${occurrencesCount.value} occurrences)`
  }

  return `Showing ${items.value.length} of ${openUniqueCount.value} issue types (${openOccurrencesCount.value} occurrences in site target)`
})

const selectedIssue = ref<AccessibilityIssue | null>(null)
const drawerOpen = ref(false)

const selectedAffectedPages = computed(() => {
  if (!selectedIssue.value) return []
  return getAffectedPagesForRule(selectedIssue.value.rule_id)
})

watch(siteId, () => {
  activeSiteId.value = siteId.value
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
})

async function openFix(issue: AccessibilityIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
  await loadAffectedPagesForRule(issue.rule_id)
}

async function onScanQueued() {
  await refreshAll({ silent: true })
}

const issuesTableRef = useTemplateRef('issuesTableRef')
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Issues">
        <template #right>
          <ScanTriggerButton :site-id="siteId" @queued="onScanQueued" />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <SitePageToolbar class="mb-2" />

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
        class="mb-4"
      />

      <div v-if="loading && !items.length" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
      </div>

      <div v-else class="space-y-4">
        <DataTableToolbar>
          <template #actions>
            <TableSearchInput
              v-model="tableSearch"
              placeholder="Search issues…"
              aria-label="Search issues"
            />
            <UDropdownMenu
              :items="issuesTableRef?.columnMenuItems ?? []"
              :content="{ align: 'end' }"
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
          </template>
        </DataTableToolbar>

        <AccessibilityIssuesTable
          ref="issuesTableRef"
          v-model:search="tableSearch"
          hide-toolbar
          :footer-summary="issuesFooterSummary"
          :issues="items"
          :score-element-totals="scoreElementTotals"
          :points-to-gain-by-rule="pointsToGainByRule"
          :rule-stats="ruleStats"
          :get-affected-pages-for-rule="getAffectedPagesForRule"
          :load-affected-pages-for-rule="loadAffectedPagesForRule"
          :site-id="siteId"
          @open="openFix"
        />
      </div>

      <AccessibilityIssueDetailDrawer
        :issue="selectedIssue"
        :affected-pages="selectedAffectedPages"
        :open="drawerOpen"
        :site-id="siteId"
        :scans="scans"
        :on-refresh="onScanQueued"
        @update:open="drawerOpen = $event"
      />
    </template>
  </AppDashboardPanel>
</template>
