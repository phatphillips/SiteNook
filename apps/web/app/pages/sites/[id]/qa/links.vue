<script setup lang="ts">
import { buildBrokenLinksCsv } from '~/utils/export/brokenLinksExport'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { brokenLinks, loading, latestScan, fetchBrokenLinks } = useQA(siteId, { summary: false, parts: ['links'] })

const view = ref<'pages' | 'links'>('pages')
const hrefSearch = ref('')

let hrefSearchTimer: ReturnType<typeof setTimeout> | null = null

watch(hrefSearch, (value) => {
  if (hrefSearchTimer) clearTimeout(hrefSearchTimer)
  hrefSearchTimer = setTimeout(() => {
    fetchBrokenLinks({ hrefQuery: value.trim() || undefined }).catch(() => {})
  }, 300)
})

const urlSearchActive = computed(() => hrefSearch.value.trim().length > 0)

const exportableLinks = computed(() => {
  if (urlSearchActive.value) return brokenLinks.value
  return brokenLinks.value.filter(link => link.status === 'broken')
})

const page = ref(1)
const pageSize = ref(exportableLinks.value.length || 1)

watch(exportableLinks, (links) => {
  pageSize.value = Math.max(1, links.length)
})

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useSimpleTableCsvExport({
  total: computed(() => exportableLinks.value.length),
  page,
  pageSize,
  currentRows: exportableLinks,
  feature: `broken-links-${view.value}`,
  scopeLabel: siteId,
  fetchAllRows: async () => exportableLinks.value,
  buildCsv: rows => buildBrokenLinksCsv(rows, view.value)
})
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Broken Links" />
    </template>
    <template #body>
      <div class="space-y-4">
        <p
          v-if="!latestScan && !loading"
          class="text-sm text-muted py-8 text-center"
        >
          No scan data yet. Run a scan to populate broken links.
        </p>

        <template v-else>
          <DataTableToolbar>
            <template #leading>
              <QaBrokenLinkViewTabs v-model="view" />
            </template>
            <template #actions>
              <TableSearchInput
                v-model="hrefSearch"
                placeholder="Filter by URL…"
                aria-label="Filter links by URL"
              />
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

          <QaBrokenLinkTable
            :links="brokenLinks"
            :view="view"
            :url-search-active="urlSearchActive"
            :loading="loading"
          />
        </template>
      </div>
    </template>
  </AppDashboardPanel>
</template>
