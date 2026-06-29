<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'inventory' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const {
  inventoryPages,
  inventory,
  loading,
  refreshing,
  error,
  latestScan,
  runningScan
} = useInventory(siteId)

const hasData = computed(() => inventoryPages.value.length > 0 || inventory.value.length > 0)
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
      <SitePageToolbar class="mb-2" />
      <UAlert
        v-if="error"
        class="mb-4"
        color="error"
        variant="subtle"
        :title="error"
      />

      <ScanStatusSummaryCard
        :scan="latestScan"
        title="Inventory data source"
        class="mb-4"
      />

      <UCard
        v-if="runningScan"
        class="mb-4 border-info/30"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="relative flex size-2">
              <span class="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-75" />
              <span class="relative inline-flex size-2 rounded-full bg-info" />
            </span>
            <p class="text-sm">
              Scanning — <strong>{{ runningScan.pages_crawled ?? 0 }}</strong> pages crawled so far.
              New pages appear below as they are discovered.
            </p>
          </div>
          <UBadge
            v-if="refreshing"
            color="info"
            variant="subtle"
            size="sm"
          >
            Updating…
          </UBadge>
        </div>
      </UCard>

      <div v-if="loading && !hasData" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
      </div>
      <template v-else>
        <p
          v-if="runningScan && !inventoryPages.length && !inventory.length"
          class="text-sm text-muted py-8 text-center"
        >
          Crawl started — pages will appear here shortly.
        </p>
        <p
          v-else-if="!hasData"
          class="text-sm text-muted py-8 text-center"
        >
          No inventory data yet. Run a scan to populate this view.
        </p>
        <QaInventoryTree
          v-else
          :pages="inventoryPages"
          :inventory="inventory"
          :refreshing="refreshing"
        />
      </template>
    </template>
  </AppDashboardPanel>
</template>
