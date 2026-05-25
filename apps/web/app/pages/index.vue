<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { sites, activeSite, fetchSites } = useSites()

onMounted(() => fetchSites())
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Overview">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <ScanTriggerButton />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard v-for="site in sites" :key="site.id" :to="`/sites/${site.id}`">
          <template #header>
            <h3 class="font-semibold">{{ site.name }}</h3>
          </template>
          <p class="text-sm text-muted truncate">{{ site.url }}</p>
          <template #footer>
            <UButton :to="`/sites/${site.id}/accessibility`" size="sm" variant="outline">
              View accessibility
            </UButton>
          </template>
        </UCard>
      </div>

      <UCard v-if="!sites.length" class="mt-4">
        <p class="text-muted">No sites yet. <NuxtLink to="/sites" class="text-primary">Add your first site</NuxtLink>.</p>
      </UCard>

      <UCard v-if="activeSite" class="mt-4">
        <template #header>
          <h3 class="font-medium">Active site: {{ activeSite.name }}</h3>
        </template>
        <p class="text-sm text-muted">{{ activeSite.url }}</p>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
