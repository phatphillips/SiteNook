<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Integrations">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <UCard>
        <p class="text-muted">Configure webhooks, Jira, and Slack integrations.</p>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
