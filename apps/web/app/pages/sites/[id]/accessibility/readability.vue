<script setup lang="ts">

definePageMeta({ middleware: 'auth' })



import type { ReadabilityPageRow } from '~/utils/readabilityMethods'

import {

  averageGaugePosition,

  averageRawScore,

  getPrimaryReadabilityMethod

} from '~/utils/readabilityMethods'
import { bucketForScore } from '~/utils/readabilityDistribution'
import { buildReadabilityCsv } from '~/utils/export/readabilityExport'



const route = useRoute()

const siteId = computed(() => route.params.id as string)

const { activeSiteId } = useSites()



const {

  site,

  siteSettings,

  pages,

  loading,

  error,

  latestScan,

  fetchReadabilityData,

  onReadabilityMethodsSaved

} = useReadability(siteId)



const showMethodPicker = ref(false)

const showPageDetail = ref(false)

const selectedPage = ref<ReadabilityPageRow | null>(null)

const tableSearch = ref('')

const tableRef = useTemplateRef('tableRef')
const selectedBreakdownBucketId = ref<string | null>(null)



const activeMethodId = computed(() =>

  getPrimaryReadabilityMethod(siteSettings.value.readabilityMethods)

)



const gaugePosition = computed(() =>

  activeMethodId.value ? averageGaugePosition(pages.value, activeMethodId.value) : null

)



const averageScore = computed(() =>

  activeMethodId.value ? averageRawScore(pages.value, activeMethodId.value) : null

)



const footerSummary = computed(() => {

  const total = filteredPages.value.length

  if (!total) return ''

  const suffix = selectedBreakdownBucketId.value ? ' (filtered by selected breakdown range)' : ''
  return `Showing ${total} ${total === 1 ? 'page' : 'pages'} from latest scan${suffix}`

})

const filteredPages = computed(() => {
  const methodId = activeMethodId.value
  const bucketId = selectedBreakdownBucketId.value
  if (!methodId || !bucketId) return pages.value
  return pages.value.filter((page) => {
    const bucket = bucketForScore(methodId, page.scores[methodId])
    return bucket?.id === bucketId
  })
})



watch(siteId, () => {
  activeSiteId.value = siteId.value
}, { immediate: true })

watch(activeMethodId, (next, prev) => {
  if (next !== prev) selectedBreakdownBucketId.value = null
})



async function handleMethodsSaved() {

  await onReadabilityMethodsSaved()

}



function onSelectPage(page: ReadabilityPageRow) {

  selectedPage.value = page

  showPageDetail.value = true

}

const exportPage = ref(1)
const exportPageSize = ref(1)
watch(filteredPages, (rows) => {
  exportPageSize.value = Math.max(1, rows.length)
})

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useSimpleTableCsvExport({
  total: computed(() => filteredPages.value.length),
  page: exportPage,
  pageSize: exportPageSize,
  currentRows: filteredPages,
  feature: 'readability',
  scopeLabel: siteId,
  fetchAllRows: async () => filteredPages.value,
  buildCsv: rows => buildReadabilityCsv(rows, siteSettings.value.readabilityMethods, {
    columnVisibility: tableRef.value?.getColumnVisibility?.()
  })
})

</script>



<template>

  <AppDashboardPanel>

    <template #header>

      <DashboardPageNavbar title="Readability">

        <template #right>

          <ScanTriggerButton :site-id="siteId" @queued="fetchReadabilityData" />

        </template>

      </DashboardPageNavbar>

    </template>



    <template #body>

      <UAlert
          v-if="error"
          class="mb-4"
          color="error"
          variant="subtle"
          :title="error"
        />

        <div class="space-y-4">
        <AccessibilityReadabilityMethodHeader

          :settings="siteSettings"

          @edit="showMethodPicker = true"

        />



        <section

          v-if="activeMethodId && pages.length"

          class="space-y-4"

        >

          <div class="rounded-lg border border-default bg-elevated p-4 sm:p-5">

            <AccessibilityReadabilityScoreGauge

              :method-id="activeMethodId"

              :position="gaugePosition"

              :raw-score="averageScore"

            />

          </div>



          <AccessibilityReadabilityDistributionPanel

            :method-id="activeMethodId"

            :pages="pages"
            :selected-bucket-id="selectedBreakdownBucketId"
            @update:selected-bucket-id="(bucketId) => { selectedBreakdownBucketId = bucketId }"

          />

        </section>



        <p
          v-if="latestScan && !pages.length && !error"
          class="text-sm text-muted"
        >
          No pages were stored for this scan yet.
        </p>



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

            :pages="filteredPages"

            :loading="loading"

            :enabled-methods="siteSettings.readabilityMethods"

            :footer-summary="footerSummary"

            @select-page="onSelectPage"

          />

        </div>
        </div>

      <AccessibilityReadabilityMethodPicker
        v-if="site"
        v-model:open="showMethodPicker"
        :site="site"
        @saved="handleMethodsSaved"
      />



      <AccessibilityReadabilityPageDetailModal

        v-if="activeMethodId"

        v-model:open="showPageDetail"

        :page="selectedPage"

        :method-id="activeMethodId"

      />

    </template>

  </AppDashboardPanel>

</template>


