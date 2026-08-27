<script setup lang="ts">
definePageMeta({
  middleware: 'marketing-public'
})

useSeoMeta({
  title: 'Accessibility',
  description: 'WCAG accessibility monitoring with SiteNook.'
})
</script>

<template>
  <MarketingContentPage
    title="Accessibility"
    description="Track WCAG issues, scores, and trends so your team can fix what matters most."
  />
</template>
