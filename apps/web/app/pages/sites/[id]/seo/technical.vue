<script setup lang="ts">
import type { SeoIssue } from '~/types/sitenook'
import { filterSeoIssues, uniqueSeoByRule } from '~/utils/seoIssues'
import { SEO_SUBCATEGORY_LABELS } from '~/utils/seoRules'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { activeSiteId } = useSites()
const { issues, crawlAudit, openIssues, loading, loadError } = useSEO(siteId, { summary: false, parts: ['issues'] })

const selectedIssue = ref<SeoIssue | null>(null)
const drawerOpen = ref(false)

const subcategoryFilter = computed(() => {
  const raw = route.query.subcategory
  return typeof raw === 'string' ? raw : 'all'
})

const subcategoryOptions = [
  { label: 'All', value: 'all' },
  { label: SEO_SUBCATEGORY_LABELS.crawlability, value: 'crawlability' },
  { label: SEO_SUBCATEGORY_LABELS.on_page, value: 'on_page' },
  { label: SEO_SUBCATEGORY_LABELS.structured_data, value: 'structured_data' }
]

const filtered = computed(() => {
  const base = filterSeoIssues(issues.value, { category: 'technical', statuses: ['open'] })
  if (subcategoryFilter.value === 'all') return base
  return base.filter(i => i.subcategory === subcategoryFilter.value)
})

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
  category: 'technical',
  issues: groupedIssues,
  total: computed(() => groupedIssues.value.length),
  page: exportPage,
  perPage: exportPageSize,
  showSiteColumn: computed(() => false),
  resolvedSiteId: siteId,
  allIssues: filtered
})

function setSubcategory(value: string) {
  navigateTo({
    path: route.path,
    query: value === 'all' ? {} : { subcategory: value }
  })
}

function openIssue(issue: SeoIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}

onMounted(() => {
  activeSiteId.value = siteId.value
})
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Technical SEO" />
    </template>
    <template #body>
      <UAlert
        v-if="loadError"
        color="error"
        variant="subtle"
        :title="loadError"
        class="mb-4"
      />

      <div
        v-if="loading && !crawlAudit"
        class="mb-6 rounded-lg border border-default bg-elevated/25 p-5 animate-pulse"
        aria-hidden="true"
      >
        <div class="h-4 w-40 rounded bg-muted/40 mb-4" />
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="h-16 rounded bg-muted/30" />
          <div class="h-16 rounded bg-muted/30" />
          <div class="h-16 rounded bg-muted/30" />
        </div>
      </div>
      <SiteFilesPanel
        v-else-if="crawlAudit"
        :audit="crawlAudit"
        :issues="openIssues"
        class="mb-6"
        @view-issue="openIssue"
      />

      <div class="flex flex-wrap gap-2 mb-4">
        <UButton
          v-for="opt in subcategoryOptions"
          :key="opt.value"
          size="sm"
          :variant="subcategoryFilter === opt.value ? 'solid' : 'outline'"
          @click="setSubcategory(opt.value)"
        >
          {{ opt.label }}
        </UButton>
      </div>

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
