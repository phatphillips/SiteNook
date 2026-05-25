<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Settings">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <UCard>
        <p class="text-muted">General application settings.</p>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
