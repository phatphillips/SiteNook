<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Team Members">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <UCard>
        <p class="text-muted">
          Team management is handled in the
          <a href="/_/" target="_blank" rel="noopener" class="text-primary">PocketBase admin</a>
          under the users collection.
        </p>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
