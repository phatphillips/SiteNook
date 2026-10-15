<script setup lang="ts">
import { fetchAllPages } from '~/utils/fetchAllPages'
import { orgApiFetch } from '~/utils/orgApiFetch'
import { buildBrokenLinksCsv } from '~/utils/export/brokenLinksExport'

definePageMeta({ middleware: 'auth' })

const { pb } = usePocketBase()
const { resolvedSiteId, isAllSites } = useWorkspaceSiteFilter()

const hrefSearch = ref('')

const { brokenLinks, loading, total, page, perPage, fetchBrokenLinks } = useOrgQA(resolvedSiteId)

let hrefSearchTimer: ReturnType<typeof setTimeout> | null = null

function load() {
  void fetchBrokenLinks({ hrefQuery: hrefSearch.value.trim() || undefined })
}

onMounted(() => {
  load()
})

watch(resolvedSiteId, () => {
  page.value = 1
  load()
})

watch(page, () => {
  load()
})

watch(hrefSearch, () => {
  if (hrefSearchTimer) clearTimeout(hrefSearchTimer)
  hrefSearchTimer = setTimeout(() => {
    page.value = 1
    void fetchBrokenLinks({ hrefQuery: hrefSearch.value.trim() || undefined })
  }, 300)
})

const urlSearchActive = computed(() => hrefSearch.value.trim().length > 0)

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
  currentRows: brokenLinks,
  feature: 'broken-links',
  scopeLabel,
  fetchAllRows: async (onProgress) => fetchAllPages(async (pageNum) => {
    const result = await orgApiFetch<{ items: typeof brokenLinks.value, total: number, perPage: number }>(
      '/api/org/qa/broken-links',
      {
        page: pageNum,
        perPage: perPage.value,
        siteId: resolvedSiteId.value,
        hrefQuery: hrefSearch.value.trim() || undefined
      }
    )
    return result
  }, {
    onProgress: (current, totalPages) => onProgress(`Fetching page ${current} of ${totalPages}…`)
  }),
  buildCsv: rows => buildBrokenLinksCsv(rows, 'links', { showSiteColumn: isAllSites.value })
})

async function onAction(payload: {
  issueIds: string[]
  action: 'dismiss' | 'reopen' | 'fixed'
}) {
  const siteId = resolvedSiteId.value
    || brokenLinks.value.find(link => payload.issueIds.includes(link.id))?.siteId
  if (!siteId || !pb?.authStore.token) return
  await $fetch(`/api/sites/${siteId}/qa/issues/bulk-status`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pb.authStore.token}` },
    body: {
      issueIds: payload.issueIds,
      issueType: 'broken_links',
      action: payload.action
    }
  })
  load()
}
</script>

<template>
  <OrgFeaturePageShell title="Broken Links">
    <div class="space-y-4">
      <DataTableToolbar>
        <template #leading>
          <TableSearchInput
            v-model="hrefSearch"
            placeholder="Filter by URL…"
            aria-label="Filter links by URL"
          />
        </template>
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

      <QaBrokenLinkTable
        view="links"
        server-paginated
        :links="brokenLinks"
        :url-search-active="urlSearchActive"
        :loading="loading"
        :page="page"
        :page-size="perPage"
        :total="total"
        :show-site-column="isAllSites"
        @update:page="(p) => { page = p }"
        @action="onAction"
      />
    </div>
  </OrgFeaturePageShell>
</template>
