<script setup lang="ts">
import type { SeoIssue } from '~/types/sitenook'
import { filterSeoIssues, uniqueSeoByRule } from '~/utils/seoIssues'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { activeSiteId } = useSites()
const { issues, loading, loadError } = useSEO(siteId, { summary: false, parts: ['issues'] })

const selectedIssue = ref<SeoIssue | null>(null)
const drawerOpen = ref(false)

const filtered = computed(() =>
  filterSeoIssues(issues.value, { category: 'content', statuses: ['open'] })
)

const groupedIssues = computed(() => uniqueSeoByRule(filtered.value))
const exportPage = ref(1)
const exportPageSize = ref(1)
watch(groupedIssues, (rows) => {
  exportPageSize.value = Math.max(1, rows.length)
})

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useSeoCsvExport({
  category: 'content',
  issues: groupedIssues,
  total: computed(() => groupedIssues.value.length),
  page: exportPage,
  perPage: exportPageSize,
  showSiteColumn: computed(() => false),
  resolvedSiteId: siteId,
  allIssues: filtered
})

onMounted(() => {
  activeSiteId.value = siteId.value
})

function openIssue(issue: SeoIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Content SEO" />
    </template>
    <template #body>
      <UAlert
        v-if="loadError"
        color="error"
        variant="subtle"
        :title="loadError"
        class="mb-4"
      />
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

      <SeoIssueTable :issues="filtered" :loading="loading" @select="openIssue" />
      <SeoIssueDetailDrawer
        :issue="selectedIssue"
        :open="drawerOpen"
        :site-id="siteId"
        @update:open="drawerOpen = $event"
      />
      </div>
    </template>
  </AppDashboardPanel>
</template>
