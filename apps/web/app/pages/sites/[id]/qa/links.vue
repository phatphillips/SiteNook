<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { brokenLinks } = useQA(siteId)
const view = ref<'pages' | 'links'>('pages')
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Broken Links">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <QaBrokenLinkTable :links="brokenLinks" :view="view" @update:view="view = $event" />
    </template>
  </UDashboardPanel>
</template>
