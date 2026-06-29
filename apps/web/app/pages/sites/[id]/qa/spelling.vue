<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { spelling } = useQA(siteId)
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Spelling" />
    </template>
    <template #body>
      <SitePageToolbar class="mb-2" />
      <QaSpellingTable :items="spelling" />
    </template>
  </AppDashboardPanel>
</template>
