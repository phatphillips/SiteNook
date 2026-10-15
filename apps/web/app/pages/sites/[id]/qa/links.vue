<script setup lang="ts">
import { buildBrokenLinksCsv } from '~/utils/export/brokenLinksExport'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const toast = useToast()
const siteId = computed(() => route.params.id as string)
const {
  brokenLinks,
  loading,
  latestScan,
  fetchBrokenLinks,
  updateQaIssueStatuses,
  recheckBrokenLink
} = useQA(siteId, { summary: false, parts: ['links'] })

const view = ref<'pages' | 'links'>('links')
const hrefSearch = ref('')
const recheckingHref = ref<string | null>(null)

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

async function onAction(payload: {
  issueIds: string[]
  action: 'dismiss' | 'reopen' | 'fixed'
}) {
  await updateQaIssueStatuses({
    issueIds: payload.issueIds,
    issueType: 'broken_links',
    action: payload.action
  })
}

async function onRecheck(payload: { issueIds: string[], href: string }) {
  if (recheckingHref.value) return
  recheckingHref.value = payload.href
  try {
    const result = await recheckBrokenLink(payload)
    if (!result) {
      toast.add({
        title: 'Recheck failed',
        description: 'Could not verify that link right now.',
        color: 'error'
      })
      return
    }
    if (result.status === 'ok') {
      toast.add({
        title: 'Link is working',
        description: `HTTP ${result.status_code}. Removed from open broken links.`,
        color: 'success'
      })
    } else if (result.status === 'redirected') {
      toast.add({
        title: 'Link redirects',
        description: `HTTP ${result.status_code}. Marked as redirected.`,
        color: 'info'
      })
    } else {
      const codeLabel = result.status_code > 0 ? String(result.status_code) : 'network error'
      toast.add({
        title: 'Still broken',
        description: `Recheck returned ${codeLabel}.`,
        color: 'warning'
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Recheck request failed'
    toast.add({
      title: 'Recheck failed',
      description: message,
      color: 'error'
    })
  } finally {
    recheckingHref.value = null
  }
}
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
          class="py-8 text-center text-sm text-muted"
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
            :rechecking-href="recheckingHref"
            @action="onAction"
            @recheck="onRecheck"
          />
        </template>
      </div>
    </template>
  </AppDashboardPanel>
</template>
