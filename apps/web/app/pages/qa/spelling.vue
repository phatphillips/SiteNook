<script setup lang="ts">
import { fetchAllPages } from '~/utils/fetchAllPages'
import { orgApiFetch } from '~/utils/orgApiFetch'
import { buildSpellingCsv } from '~/utils/export/spellingExport'

definePageMeta({ middleware: 'auth' })



const { resolvedSiteId, isAllSites } = useWorkspaceSiteFilter()

const tab = ref<'errors' | 'review'>('errors')

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
  buildCsv: rows => buildSpellingCsv(rows, { showSiteColumn: isAllSites.value })
})

</script>



<template>

  <OrgFeaturePageShell title="Spelling">

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

    <QaSpellingTable

      v-model:tab="tab"

      server-paginated

      :items="spelling"

      :loading="loading"

      :page="page"

      :page-size="perPage"

      :total="total"

      show-site-column

      @update:page="(p) => { page = p }"

    />
    </div>

  </OrgFeaturePageShell>

</template>

