<script setup lang="ts">
import type { SearchContentType, SearchMode } from '~/types/globalSearch'
import type { GlobalSearchResultItem } from '~/types/globalSearch'
import { MIN_QUERY_LENGTH } from '~/utils/globalSearch'
import GlobalSearchResultsTable from '~/components/search/GlobalSearchResultsTable.vue'
import { buildSearchResultsCsv } from '~/utils/export/searchExport'

/** USelectMenu cannot use empty string as a value. Use a sentinel for “all sites”. */
const ALL_SITES = '__all__'

definePageMeta({ middleware: 'auth' })

const { sites, fetchSites } = useSites()
const { loading, error, results, search, clearResults } = useGlobalSearch()

const query = ref('')
const mode = ref<SearchMode>('exact')
const contentType = ref<SearchContentType>('all')
const siteFilter = ref<string>(ALL_SITES)
const page = ref(1)
const hasSearched = ref(false)
const queryTooShort = ref(false)

const resultsTableRef = useTemplateRef('resultsTableRef')

const modeOptions = [
  { label: 'Exact', value: 'exact' },
  { label: 'Contains', value: 'contains' },
  { label: 'Regex', value: 'regex' }
]

const typeOptions = [
  { label: 'All content', value: 'all' },
  { label: 'Webpages', value: 'webpages' },
  { label: 'PDFs', value: 'pdfs' }
]

const siteOptions = computed(() => [
  { label: 'All sites', value: ALL_SITES },
  ...sites.value.map(site => ({ label: site.name, value: site.id }))
])

function resolvedSiteId(): string | undefined {
  return siteFilter.value === ALL_SITES ? undefined : siteFilter.value
}

const showSiteColumn = computed(() => siteFilter.value === ALL_SITES)
const canSearch = computed(() => query.value.trim().length >= MIN_QUERY_LENGTH)

const selectedSiteName = computed(() => {
  if (siteFilter.value === ALL_SITES) return 'All sites'
  return sites.value.find(site => site.id === siteFilter.value)?.name ?? 'Site'
})

const modeLabel = computed(() =>
  modeOptions.find(option => option.value === mode.value)?.label ?? 'Exact'
)

const resultsSummary = computed(() => {
  if (!results.value || loading.value) return ''
  const count = results.value.totalItems.toLocaleString()
  const noun = results.value.totalItems === 1 ? 'result' : 'results'
  return `${count} ${noun} · ${modeLabel.value} · ${selectedSiteName.value}`
})

const showEmptyState = computed(() => !hasSearched.value && !loading.value)
const showResultsArea = computed(() => hasSearched.value || loading.value)

onMounted(() => {
  fetchSites().catch(() => {})
})

async function runSearch(resetPage = true) {
  if (!canSearch.value) {
    queryTooShort.value = true
    return
  }
  queryTooShort.value = false
  if (resetPage) page.value = 1
  hasSearched.value = true
  await search({
    q: query.value.trim(),
    mode: mode.value,
    type: contentType.value,
    siteId: resolvedSiteId(),
    page: page.value
  })
}

function onClear() {
  query.value = ''
  siteFilter.value = ALL_SITES
  page.value = 1
  hasSearched.value = false
  queryTooShort.value = false
  clearResults()
}

async function onPageChange(nextPage: number) {
  page.value = nextPage
  await runSearch(false)
}

watch([mode, contentType, siteFilter], () => {
  if (!hasSearched.value || !canSearch.value) return
  void runSearch(true)
})

watch(query, () => {
  if (query.value.trim().length >= MIN_QUERY_LENGTH) {
    queryTooShort.value = false
  }
})

const searchPerPage = computed(() => results.value?.perPage ?? 20)
const searchRows = computed(() => results.value?.items ?? [])

const scopeLabel = computed(() => resolvedSiteId() ?? 'org')

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useSimpleTableCsvExport({
  total: computed(() => results.value?.totalItems ?? 0),
  page,
  pageSize: searchPerPage,
  currentRows: searchRows,
  feature: 'search',
  scopeLabel,
  fetchAllRows: async (onProgress) => {
    if (!results.value || !canSearch.value) return []
    const all: GlobalSearchResultItem[] = []
    const totalPages = Math.max(1, results.value.totalPages)
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress(`Fetching page ${pageNum} of ${totalPages}…`)
      const response = await search({
        q: query.value.trim(),
        mode: mode.value,
        type: contentType.value,
        siteId: resolvedSiteId(),
        page: pageNum,
        perPage: results.value.perPage
      })
      if (response?.items) all.push(...response.items)
    }
    return all
  },
  buildCsv: rows => buildSearchResultsCsv(rows, { showSiteColumn: showSiteColumn.value })
})
</script>

<template>
  <AppDashboardPanel id="global-search">
    <template #header>
      <DashboardPageNavbar title="Search">
        <template #right>
          <GlobalSearchHelpPopover />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="space-y-3">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div class="min-w-0 flex-1">
              <UInput
                v-model="query"
                icon="i-lucide-search"
                size="lg"
                placeholder="Search text, URLs, or PDF content…"
                aria-label="Search query"
                :ui="{ root: 'w-full' }"
                @keydown.enter="runSearch()"
              />
              <p
                v-if="queryTooShort"
                class="mt-1.5 text-xs text-error"
              >
                Enter at least {{ MIN_QUERY_LENGTH }} characters.
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <UButton
                color="neutral"
                variant="solid"
                size="lg"
                icon="i-lucide-search"
                :loading="loading"
                @click="runSearch()"
              >
                Search
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                size="lg"
                :disabled="loading && !results && !query"
                @click="onClear"
              >
                Clear
              </UButton>
            </div>
          </div>

          <div class="flex flex-wrap items-end gap-3">
            <UFormField label="Content type" class="min-w-36">
              <USelectMenu
                v-model="contentType"
                :items="typeOptions"
                value-key="value"
                size="sm"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Match mode" class="min-w-36">
              <USelectMenu
                v-model="mode"
                :items="modeOptions"
                value-key="value"
                size="sm"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Site" class="min-w-44">
              <USelectMenu
                v-model="siteFilter"
                :items="siteOptions"
                value-key="value"
                size="sm"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />

        <UAlert
          v-else-if="results?.truncated"
          color="warning"
          variant="subtle"
          :title="results.message || 'Results truncated'"
        />

        <div
          v-if="showEmptyState"
          class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default px-6 py-16 text-center"
        >
          <UIcon
            name="i-lucide-search"
            class="size-10 text-muted mb-4"
          />
          <p class="text-sm font-medium text-default mb-1">
            Search across your latest crawls
          </p>
          <p class="text-sm text-muted max-w-md">
            Find phrases, domains, and PDF content indexed from your most recent scans.
          </p>
        </div>

        <template v-if="showResultsArea">
          <DataTableToolbar>
            <template #leading>
              <p
                v-if="resultsSummary"
                class="text-sm text-muted truncate max-w-xl"
              >
                {{ resultsSummary }}
                <span
                  v-if="query.trim()"
                  class="text-default"
                > for “{{ query.trim() }}”</span>
              </p>
              <p
                v-else-if="loading"
                class="text-sm text-muted"
              >
                Searching…
              </p>
            </template>
            <template #actions>
              <UDropdownMenu
                :items="resultsTableRef?.columnMenuItems ?? []"
                :content="{ align: 'end' }"
              >
                <TableToolbarMenuButton
                  label="Columns"
                  icon="i-lucide-columns-3"
                  aria-label="Toggle column visibility"
                />
              </UDropdownMenu>
              <UButton
                icon="i-lucide-download"
                label="Export to CSV"
                color="neutral"
                variant="outline"
                :disabled="!results?.totalItems"
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

          <p
            v-if="contentType === 'pdfs' && results && results.totalItems === 0 && !loading"
            class="text-sm text-muted"
          >
            No PDF matches found. PDF text is indexed during site scans. For links inside PDFs, try the hostname without the protocol (e.g. <code class="text-xs">www.example.com</code>).
          </p>

          <GlobalSearchResultsTable
            v-if="results || loading"
            ref="resultsTableRef"
            :items="results?.items ?? []"
            :loading="loading"
            :show-site-column="showSiteColumn"
            :page="results?.page ?? 1"
            :total-pages="results?.totalPages ?? 1"
            :total-items="results?.totalItems ?? 0"
            :query="query.trim()"
            @update:page="onPageChange"
          />
        </template>
      </div>
    </template>
  </AppDashboardPanel>
</template>
