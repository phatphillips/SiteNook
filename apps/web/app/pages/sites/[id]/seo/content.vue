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
const tableSearch = ref('')
const tableRef = useTemplateRef('tableRef')

const filtered = computed(() =>
  filterSeoIssues(issues.value, { category: 'content', statuses: ['open'] })
)

const groupedIssues = computed(() => uniqueSeoByRule(filtered.value))
const exportPage = ref(1)
const exportPageSize = ref(1)
watch(groupedIssues, (rows) => {
  exportPageSize.value = Math.max(1, rows.length)
})

const footerSummary = computed(() => {
  if (loading.value && !filtered.value.length) return ''
  const count = groupedIssues.value.length
  if (!count) return ''
  if (tableSearch.value.trim().length > 0) {
    return 'Showing filtered issue types in site target'
  }
  return `Showing ${count.toLocaleString()} issue ${count === 1 ? 'type' : 'types'} in site target`
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
          <template #leading>
            <div class="flex min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2">
              <TableSearchInput
                v-model="tableSearch"
                placeholder="Search issues…"
                aria-label="Search SEO content issues"
              />
              <UDropdownMenu
                :items="tableRef?.columnMenuItems ?? []"
                :content="{ align: 'start' }"
              >
                <TableToolbarMenuButton
                  label="Columns"
                  icon="i-lucide-columns-3"
                  aria-label="Toggle column visibility"
                />
              </UDropdownMenu>
            </div>
          </template>
          <template #actions>
            <UButton
              icon="i-lucide-download"
              label="Export to CSV"
              color="neutral"
              variant="outline"
              size="sm"
              class="max-lg:aspect-square max-lg:!px-2"
              :ui="{ base: 'h-8', label: 'hidden lg:inline' }"
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
          ref="tableRef"
          v-model:search="tableSearch"
          :issues="filtered"
          :loading="loading"
          :footer-summary="footerSummary"
          @select="openIssue"
        />
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
