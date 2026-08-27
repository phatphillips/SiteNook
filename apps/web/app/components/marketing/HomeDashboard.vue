<script setup lang="ts">
const { fetchSites, isAllSites, activeSiteId } = useSites()

onMounted(async () => {
  await fetchSites()
})
</script>

<template>
  <div class="min-h-0 h-full flex flex-col">
    <DashboardOverview
      v-if="isAllSites"
      all-sites
    />
    <DashboardOverview
      v-else-if="activeSiteId"
      :site-id="activeSiteId"
    />
  </div>
</template>
