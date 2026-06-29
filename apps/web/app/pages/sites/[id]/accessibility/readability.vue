<script setup lang="ts">

definePageMeta({ middleware: 'auth' })



import type { ReadabilityPageRow } from '~/utils/readabilityMethods'

import {

  averageGaugePosition,

  averageRawScore,

  getPrimaryReadabilityMethod

} from '~/utils/readabilityMethods'



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

  const total = pages.value.length

  if (!total) return ''

  return `Showing ${total} ${total === 1 ? 'page' : 'pages'} from latest scan`

})



onMounted(() => {

  activeSiteId.value = siteId.value

  fetchReadabilityData()

})



async function handleMethodsSaved() {

  await onReadabilityMethodsSaved()

}



function onSelectPage(page: ReadabilityPageRow) {

  selectedPage.value = page

  showPageDetail.value = true

}

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

      <SitePageToolbar class="mb-2" />

      <div v-if="loading" class="flex justify-center py-12">

        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />

      </div>



      <template v-else>

        <UAlert
          v-if="error"
          class="mb-4"
          color="error"
          variant="subtle"
          :title="error"
        />

        <AccessibilityReadabilityMethodHeader

          :settings="siteSettings"

          @edit="showMethodPicker = true"

        />



        <section

          v-if="activeMethodId && pages.length"

          class="mb-6 space-y-4"

        >

          <div class="rounded-lg border border-default bg-elevated/25 p-4 sm:p-5">

            <AccessibilityReadabilityScoreGauge

              :method-id="activeMethodId"

              :position="gaugePosition"

              :raw-score="averageScore"

            />

          </div>



          <AccessibilityReadabilityDistributionPanel

            :method-id="activeMethodId"

            :pages="pages"

          />

        </section>



        <p
          v-if="latestScan"
          class="text-sm text-muted mb-4"
        >
          Latest scan: {{ latestScan.completed_at || latestScan.created }}<template v-if="!pages.length && !error"> — no pages were stored for this scan yet.</template>
        </p>



        <div class="space-y-4">

          <DataTableToolbar>

            <template #actions>

              <TableSearchInput

                v-model="tableSearch"

                placeholder="Search pages…"

                aria-label="Search readability pages"

              />

              <UDropdownMenu :items="tableRef?.columnMenuItems ?? []">

                <TableToolbarMenuButton label="Columns" icon="i-lucide-columns-3" />

              </UDropdownMenu>

            </template>

          </DataTableToolbar>



          <AccessibilityReadabilityPagesTable

            ref="tableRef"

            v-model:search="tableSearch"

            :pages="pages"

            :enabled-methods="siteSettings.readabilityMethods"

            :footer-summary="footerSummary"

            @select-page="onSelectPage"

          />

        </div>

      </template>



      <AccessibilityReadabilityMethodPicker

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


