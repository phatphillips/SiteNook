<script setup lang="ts">
definePageMeta({
  middleware: 'marketing-public'
})

useSeoMeta({
  title: 'Readability',
  description: 'Page readability scoring with SiteNook.'
})
</script>

<template>
  <MarketingContentPage
    title="Readability"
    description="See how hard your pages are to read and prioritize content that needs simplifying."
  />
</template>
