<script setup lang="ts">
defineOptions({ name: 'HomeDashboard' })

const { sites, activeSite, fetchSites } = useSites()

onMounted(() => fetchSites())
</script>

<template>
  <AppDashboardPanel id="home">
    <template #header>
      <DashboardPageNavbar title="Overview">
        <template #right>
          <ScanTriggerButton />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <UCard v-for="site in sites" :key="site.id" :to="`/sites/${site.id}`">
          <template #header>
            <h3 class="font-semibold">
              {{ site.name }}
            </h3>
          </template>
          <p class="truncate text-sm text-muted">
            {{ site.url }}
          </p>
          <template #footer>
            <UButton :to="`/sites/${site.id}/accessibility`" size="sm" variant="outline">
              View accessibility
            </UButton>
          </template>
        </UCard>
      </div>

      <UCard v-if="!sites.length" class="mt-4">
        <p class="text-muted">
          No sites yet.
          <NuxtLink to="/sites" class="text-primary">
            Add your first site
          </NuxtLink>.
        </p>
      </UCard>

      <UCard v-if="activeSite" class="mt-4">
        <template #header>
          <h3 class="font-medium">
            Active site: {{ activeSite.name }}
          </h3>
        </template>
        <p class="text-sm text-muted">
          {{ activeSite.url }}
        </p>
      </UCard>
    </template>
  </AppDashboardPanel>
</template>
