<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const pageId = computed(() => route.params.pageId as string)

onMounted(async () => {
  await navigateTo({
    path: `/sites/${siteId.value}/accessibility/simulator`,
    query: { page: pageId.value },
    replace: true
  })
})
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Simulator" />
    </template>
    <template #body>
      <div class="flex justify-center py-12">
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin text-muted"
        />
      </div>
    </template>
  </AppDashboardPanel>
</template>
