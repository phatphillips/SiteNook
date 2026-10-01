<script setup lang="ts">
import type { SeoIssue } from '~/types/sitenook'
import { uniqueSeoByRule } from '~/utils/seoIssues'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })

const { resolvedSiteId, isAllSites } = useWorkspaceSiteFilter()
const { issues, loading, total, page, perPage, fetchIssues } = useOrgSEO(resolvedSiteId)
const selectedIssue = ref<SeoIssue | null>(null)
const drawerOpen = ref(false)
const tableSearch = ref('')
const tableRef = useTemplateRef('tableRef')

onMounted(() => {
  void fetchIssues('content')
})

watch(resolvedSiteId, () => {
  void fetchIssues('content')
})

function onSelect(issue: SeoIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}

const groupedIssues = computed(() => uniqueSeoByRule(issues.value))

const footerSummary = computed(() => {
  if (loading.value && !issues.value.length) return ''
  const count = groupedIssues.value.length
  if (!count) return ''
  const scope = isAllSites.value ? 'across all sites' : 'in site target'
  const searchActive = tableSearch.value.trim().length > 0
  if (searchActive) {
    return `Showing filtered issue types ${scope}`
  }
  return `Showing ${count.toLocaleString()} issue ${count === 1 ? 'type' : 'types'} ${scope}`
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
  total,
  page,
  perPage,
  showSiteColumn: computed(() => isAllSites.value),
  resolvedSiteId
})
</script>

<template>
  <OrgFeaturePageShell title="SEO Content">
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
        :issues="issues"
        :loading="loading"
        :show-site-column="isAllSites"
        :footer-summary="footerSummary"
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
