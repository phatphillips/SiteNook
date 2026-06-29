<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Integrations" />
    </template>
    <template #body>
      <UCard>
        <p class="text-muted">Configure webhooks, Jira, and Slack integrations.</p>
      </UCard>
    </template>
  </AppDashboardPanel>
</template>
