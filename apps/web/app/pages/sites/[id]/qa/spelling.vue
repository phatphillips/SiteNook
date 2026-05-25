<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { spelling } = useQA(siteId)
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Spelling">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <QaSpellingTable :items="spelling" />
    </template>
  </UDashboardPanel>
</template>
