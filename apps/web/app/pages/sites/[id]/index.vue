<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { pb } = usePocketBase()
const { activeSiteId } = useSites()
const site = ref<{ name: string, url: string } | null>(null)

onMounted(async () => {
  activeSiteId.value = siteId.value
  site.value = await pb.collection('sites').getOne(siteId.value) as { name: string, url: string }
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="site?.name || 'Site'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <ScanTriggerButton :site-id="siteId" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="grid md:grid-cols-2 gap-4">
        <UCard :to="`/sites/${siteId}/accessibility`">
          <template #header><h3 class="font-medium">Accessibility</h3></template>
          <p class="text-sm text-muted">WCAG compliance dashboard</p>
        </UCard>
        <UCard :to="`/sites/${siteId}/qa`">
          <template #header><h3 class="font-medium">Quality Assurance</h3></template>
          <p class="text-sm text-muted">Links, spelling, inventory</p>
        </UCard>
      </div>
      <p v-if="site" class="mt-4 text-sm text-muted">{{ site.url }}</p>
    </template>
  </UDashboardPanel>
</template>
