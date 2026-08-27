<script setup lang="ts">

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'inventory' })



const route = useRoute()

const siteId = computed(() => route.params.id as string)



const {

  tab,

  search,

  page,

  perPage,

  total,

  pages,

  assets,

  loading,

  refreshing,

  error,

  fetchInventory

} = useOrgInventory({ siteId })



const { isRunning } = useWorkspaceScanState(siteId)
const { loadSourcePages } = useInventorySourcePages({ siteId })

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useInventoryCsvExport({
  tab,
  search,
  page,
  perPage,
  total,
  pages,
  assets,
  resolvedSiteId: siteId,
  showSiteColumn: computed(() => false),
  loadSourcePages
})



watch(isRunning, (running, wasRunning) => {

  if (wasRunning && !running) {

    void fetchInventory()

  }

})

</script>



<template>

  <AppDashboardPanel>

    <template #header>

      <DashboardPageNavbar title="Content Inventory">

        <template #right>

          <ScanTriggerButton :site-id="siteId" />

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

      <QaInventoryTablePanel

        v-model:tab="tab"

        v-model:search="search"

        :pages="pages"

        :assets="assets"

        :loading="loading"

        :refreshing="refreshing"

        server-paginated

        :total="total"

        :page="page"

        :page-size="perPage"

        @update:page="page = $event"

      />
      </div>

    </template>

  </AppDashboardPanel>

</template>


