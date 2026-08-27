<script setup lang="ts">
import type { SeoIssue } from '~/types/sitenook'
import { uniqueSeoByRule } from '~/utils/seoIssues'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })

const { resolvedSiteId, isAllSites } = useWorkspaceSiteFilter()
const { issues, loading, total, page, perPage, fetchIssues } = useOrgSEO(resolvedSiteId)
const selectedIssue = ref<SeoIssue | null>(null)
const drawerOpen = ref(false)

onMounted(() => {
  void fetchIssues('technical')
})

watch(resolvedSiteId, () => {
  void fetchIssues('technical')
})

function onSelect(issue: SeoIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}

const groupedIssues = computed(() => uniqueSeoByRule(issues.value))

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useSeoCsvExport({
  category: 'technical',
  issues: groupedIssues,
  total,
  page,
  perPage,
  showSiteColumn: computed(() => isAllSites.value),
  resolvedSiteId
})
</script>

<template>
  <OrgFeaturePageShell title="SEO Technical">
    <div class="space-y-4">
      <DataTableToolbar>
        <template #actions>
          <UButton
            icon="i-lucide-download"
            label="Export to CSV"
            color="neutral"
            variant="outline"
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

    <SeoIssueTable
      :issues="issues"
      :loading="loading"
      show-site-column
      @select="onSelect"
    />
    <SeoIssueDetailDrawer
      :issue="selectedIssue"
      :open="drawerOpen"
      :site-id="(selectedIssue as SeoIssue & { siteId?: string })?.siteId"
      @update:open="drawerOpen = $event"
    />
    </div>
  </OrgFeaturePageShell>
</template>
