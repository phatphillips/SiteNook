<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { pages, inventory } = useQA(siteId)
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Content Inventory">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <QaInventoryTree :pages="pages" :inventory="inventory" />
    </template>
  </UDashboardPanel>
</template>
