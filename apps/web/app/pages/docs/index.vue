<script setup lang="ts">
definePageMeta({
  middleware: 'marketing-public'
})

useSeoMeta({
  title: 'Documentation',
  description: 'Setup guides and reference for SiteNook.'
})
</script>

<template>
  <MarketingContentPage
    title="Documentation"
    description="Learn how to add sites, run scans, and interpret accessibility and QA results."
  />
</template>
