<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
</script>

<template>
  <AppDashboardPanel full-width>
    <template #header>
      <DashboardPageNavbar title="Quality Assurance">
        <template #right>
          <ScanTriggerButton :site-id="siteId" />
        </template>
      </DashboardPageNavbar>
    </template>
    <template #body>
      <QaSiteOverviewPanel :site-id="siteId" />
    </template>
  </AppDashboardPanel>
</template>
