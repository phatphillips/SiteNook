<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
</script>

<template>
  <DashboardOverview :site-id="siteId" />
</template>
