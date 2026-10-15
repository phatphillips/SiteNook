<script setup lang="ts">
import {
  averageGaugePosition,
  averageRawScore,
  getPrimaryReadabilityMethod,
  DEFAULT_READABILITY_METHODS,
  type ReadabilityMethodId
} from '~/utils/readabilityMethods'
import { bucketForScore } from '~/utils/readabilityDistribution'
import type { SiteSettings } from '~/utils/siteSettings'
import { getDefaultSiteSettings } from '~/utils/siteSettings'
import { fetchAllPages } from '~/utils/fetchAllPages'
import { orgApiFetch } from '~/utils/orgApiFetch'
import { buildReadabilityCsv } from '~/utils/export/readabilityExport'
import type { OrgReadabilityPageRow } from '~/composables/useOrgReadability'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const { resolvedSiteId, isAllSites } = useWorkspaceSiteFilter()

const {
  pages,
  summaryPages,
  loading,
  summaryLoading,
  total,
  page,
  perPage,
  fetchAll,
  fetchPages,
  selectedBucketId,
  selectedMethodId
} = useOrgReadability(resolvedSiteId)

const tableSearch = ref('')
const tableRef = useTemplateRef('tableRef')
const showMethodPicker = ref(false)
const selectedBreakdownBucketId = ref<string | null>(null)

const orgReadabilityMethods = useState<ReadabilityMethodId[]>(
  'org-readability-methods',
  () => [...DEFAULT_READABILITY_METHODS]
)

const orgSettings = computed<SiteSettings>(() => ({
  ...getDefaultSiteSettings(),
  readabilityMethods: orgReadabilityMethods.value
}))

const activeMethodId = computed(() =>
  getPrimaryReadabilityMethod(orgSettings.value.readabilityMethods)
)

const summaryInitialLoading = computed(
  () => summaryLoading.value && !summaryPages.value.length
)

provide('featurePageBannerLoading', summaryInitialLoading)

const gaugePosition = computed(() =>
  activeMethodId.value ? averageGaugePosition(summaryPages.value, activeMethodId.value) : null
)

const averageScore = computed(() =>
  activeMethodId.value ? averageRawScore(summaryPages.value, activeMethodId.value) : null
)

const footerSummary = computed(() => {
  if (loading.value && !pages.value.length) return ''
  if (!total.value) return ''
  const start = (page.value - 1) * perPage.value + 1
  const end = Math.min(page.value * perPage.value, total.value)
  const scope = isAllSites.value ? 'across all sites' : 'in site target'
  const filterSuffix = selectedBreakdownBucketId.value ? ' (filtered by selected breakdown range)' : ''
  return `Showing ${start}-${end} of ${total.value.toLocaleString()} pages ${scope}${filterSuffix}`
})

async function load() {
  await fetchAll()
}

onMounted(() => {
  void load()
})

watch([resolvedSiteId, isAllSites, () => route.path], () => {
  page.value = 1
  void load()
})

watch(page, () => {
  void fetchPages()
})

watch(activeMethodId, (next, prev) => {
  if (next !== prev) selectedBreakdownBucketId.value = null
})

watch([activeMethodId, selectedBreakdownBucketId], ([methodId, bucketId]) => {
  selectedMethodId.value = methodId ?? null
  selectedBucketId.value = bucketId
  page.value = 1
  void fetchPages()
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
  currentRows: pages,
  feature: 'readability',
  scopeLabel,
  fetchAllRows: async (onProgress) => fetchAllPages(async (pageNum) => {
    const result = await orgApiFetch<{
      items: OrgReadabilityPageRow[]
      total: number
      perPage: number
    }>('/api/org/readability/pages', {
      page: pageNum,
      perPage: perPage.value,
      siteId: resolvedSiteId.value,
      methodId: selectedMethodId.value ?? undefined,
      bucketId: selectedBucketId.value ?? undefined
    })
    return result
  }, {
    onProgress: (current, totalPages) => onProgress(`Fetching page ${current} of ${totalPages}…`)
  }),
  buildCsv: rows => buildReadabilityCsv(rows, orgReadabilityMethods.value, {
    showSiteColumn: isAllSites.value,
    columnVisibility: tableRef.value?.getColumnVisibility?.()
  })
})
</script>

<template>
  <OrgFeaturePageShell title="Readability">
    <div class="space-y-6">
      <AccessibilityReadabilityMethodHeader
        :settings="orgSettings"
        :loading="summaryInitialLoading"
        @edit="showMethodPicker = true"
      />

      <section
        v-if="activeMethodId && (summaryPages.length || summaryInitialLoading)"
        class="space-y-4"
      >
        <template v-if="summaryInitialLoading">
          <div class="rounded-lg border border-default bg-elevated p-4 sm:p-5">
            <AccessibilityReadabilityScoreGaugeSkeleton />
          </div>
          <AccessibilityReadabilityDistributionPanelSkeleton />
        </template>

        <template v-else-if="summaryPages.length">
          <div class="rounded-lg border border-default bg-elevated p-4 sm:p-5">
            <AccessibilityReadabilityScoreGauge
              :method-id="activeMethodId"
              :position="gaugePosition"
              :raw-score="averageScore"
            />
          </div>

          <AccessibilityReadabilityDistributionPanel
            :method-id="activeMethodId"
            :pages="summaryPages"
            :selected-bucket-id="selectedBreakdownBucketId"
            @update:selected-bucket-id="(bucketId) => { selectedBreakdownBucketId = bucketId }"
          />
        </template>
      </section>

      <div class="space-y-4">
        <DataTableToolbar>
          <template #leading>
            <TableSearchInput
              v-model="tableSearch"
              placeholder="Search pages…"
              aria-label="Search readability pages"
            />
            <UDropdownMenu :items="tableRef?.columnMenuItems ?? []">
              <TableToolbarMenuButton label="Columns" icon="i-lucide-columns-3" />
            </UDropdownMenu>
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

        <AccessibilityReadabilityPagesTable
          ref="tableRef"
          v-model:search="tableSearch"
          server-paginated
          :loading="loading"
          :page="page"
          :page-size="perPage"
          :total="total"
          :pages="pages"
          :enabled-methods="orgReadabilityMethods"
          :footer-summary="footerSummary"
          :show-site-column="!isAllSites"
          @update:page="(p) => { page = p }"
        />
      </div>
    </div>

    <AccessibilityReadabilityMethodPicker
      v-model:open="showMethodPicker"
      local-only
      :site="null"
      :methods="orgReadabilityMethods"
      @update:methods="(methods) => { orgReadabilityMethods = methods }"
    />
  </OrgFeaturePageShell>
</template>
