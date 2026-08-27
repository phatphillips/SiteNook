<script setup lang="ts">
definePageMeta({
  middleware: 'marketing-public'
})

useSeoMeta({
  title: 'Scanning',
  description: 'Live site scanning with SiteNook.'
})
</script>

<template>
  <MarketingContentPage
    title="Scanning"
    description="Watch crawls run in real time — pages crawled, progress, and activity logs."
  />
</template>
