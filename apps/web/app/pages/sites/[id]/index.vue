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
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar :title="site?.name || 'Site'">
        <template #right>
          <ScanTriggerButton :site-id="siteId" />
        </template>
      </DashboardPageNavbar>
    </template>
    <template #body>
      <SitePageToolbar class="mb-2" />
      <div class="grid md:grid-cols-3 gap-4">
        <UCard :to="`/sites/${siteId}/accessibility`">
          <template #header><h3 class="font-medium">Accessibility</h3></template>
          <p class="text-sm text-muted">WCAG compliance dashboard</p>
        </UCard>
        <UCard :to="`/sites/${siteId}/qa`">
          <template #header><h3 class="font-medium">Quality Assurance</h3></template>
          <p class="text-sm text-muted">Links, spelling, inventory</p>
        </UCard>
        <UCard :to="`/sites/${siteId}/seo`">
          <template #header><h3 class="font-medium">SEO</h3></template>
          <p class="text-sm text-muted">Technical &amp; content SEO</p>
        </UCard>
      </div>
      <p v-if="site" class="mt-4 text-sm text-muted">{{ site.url }}</p>
    </template>
  </AppDashboardPanel>
</template>
