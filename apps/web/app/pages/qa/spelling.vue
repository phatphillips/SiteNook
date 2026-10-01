<script setup lang="ts">
import { fetchAllPages } from '~/utils/fetchAllPages'
import { orgApiFetch } from '~/utils/orgApiFetch'
import { buildSpellingCsv } from '~/utils/export/spellingExport'

definePageMeta({ middleware: 'auth' })

const { resolvedSiteId, isAllSites } = useWorkspaceSiteFilter()

const tab = ref<'errors' | 'review'>('errors')
const tableSearch = ref('')
const tableRef = useTemplateRef('tableRef')

const { spelling, loading, total, page, perPage, fetchSpelling } = useOrgQA(resolvedSiteId)

function load() {
  void fetchSpelling({ confidence: tab.value === 'errors' ? 'error' : 'review' })
}

onMounted(() => {
  load()
})

watch(resolvedSiteId, () => {
  page.value = 1
  load()
})

watch(tab, () => {
  page.value = 1
  load()
})

watch(page, () => {
  load()
})

const scopeLabel = computed(() => resolvedSiteId.value ?? 'org')

const footerSummary = computed(() => {
  if (loading.value && !spelling.value.length) return ''
  if (!total.value) return ''
  const start = (page.value - 1) * perPage.value + 1
  const end = Math.min(page.value * perPage.value, total.value)
  const scope = isAllSites.value ? 'across all sites' : 'in site target'
  const category = tab.value === 'errors' ? 'misspellings' : 'words to review'
  const searchSuffix = tableSearch.value.trim() ? ' (filtered)' : ''
  return `Showing ${start}-${end} of ${total.value.toLocaleString()} ${category} ${scope}${searchSuffix}`
})

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useSimpleTableCsvExport({
  total,
  page,
  pageSize: perPage,
  currentRows: spelling,
  feature: `spelling-${tab.value}`,
  scopeLabel,
  fetchAllRows: async (onProgress) => fetchAllPages(async (pageNum) => {
    const result = await orgApiFetch<{ items: typeof spelling.value, total: number, perPage: number }>(
      '/api/org/qa/spelling',
      {
        page: pageNum,
        perPage: perPage.value,
        siteId: resolvedSiteId.value,
        confidence: tab.value === 'errors' ? 'error' : 'review'
      }
    )
    return result
  }, {
    onProgress: (current, totalPages) => onProgress(`Fetching page ${current} of ${totalPages}…`)
  }),
  buildCsv: rows => buildSpellingCsv(rows, {
    showSiteColumn: isAllSites.value
  })
})
</script>

<template>
  <OrgFeaturePageShell title="Spelling">
    <div class="space-y-4">
      <DataTableToolbar>
        <template #leading>
          <div class="flex min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2">
            <UTabs
              v-model="tab"
              :items="[
                { label: 'Misspellings', value: 'errors' },
                { label: 'Words to Review', value: 'review' }
              ]"
              :content="false"
              size="sm"
              class="w-auto"
            />
            <TableSearchInput
              v-model="tableSearch"
              placeholder="Search spelling…"
              aria-label="Search spelling issues"
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

      <QaSpellingTable
        ref="tableRef"
        v-model:tab="tab"
        v-model:search="tableSearch"
        :show-tabs="false"
        server-paginated
        :items="spelling"
        :loading="loading"
        :page="page"
        :page-size="perPage"
        :total="total"
        :footer-summary="footerSummary"
        :show-site-column="isAllSites"
        @update:page="(p) => { page = p }"
      />
    </div>
  </OrgFeaturePageShell>
</template>
