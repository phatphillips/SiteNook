<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'inventory' })

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
  error
} = useOrgInventory()

const { isAllSites, resolvedSiteId } = useWorkspaceSiteFilter()
const { loadSourcePages } = useInventorySourcePages()

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
  resolvedSiteId,
  showSiteColumn: computed(() => isAllSites.value),
  loadSourcePages
})
</script>

<template>
  <OrgFeaturePageShell title="Content Inventory">
    <UAlert
      v-if="error"
      class="mb-4"
      color="error"
      variant="subtle"
      :title="error"
    />

    <div class="space-y-4">
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
        :show-site-column="isAllSites"
        server-paginated
        :total="total"
        :page="page"
        :page-size="perPage"
        @update:page="page = $event"
      >
        <template #toolbar-actions>
          <UButton
            icon="i-lucide-download"
            label="Export to CSV"
            color="neutral"
            variant="outline"
            @click="exportModalOpen = true"
          />
        </template>
      </QaInventoryTablePanel>
    </div>
  </OrgFeaturePageShell>
</template>
