<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const panelRef = ref<{ fetchSiteData?: (opts?: { silent?: boolean }) => Promise<void> } | null>(null)

function onScanQueued() {
  void panelRef.value?.fetchSiteData?.()
}
</script>

<template>
  <AppDashboardPanel full-width>
    <template #header>
      <DashboardPageNavbar title="Accessibility">
        <template #right>
          <ScanTriggerButton :site-id="siteId" @queued="onScanQueued" />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <AccessibilitySiteOverviewPanel
        ref="panelRef"
        :site-id="siteId"
      />
    </template>
  </AppDashboardPanel>
</template>
