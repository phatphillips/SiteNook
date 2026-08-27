<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })
</script>

<template>
  <OrgSectionOverviewPage section="seo" />
</template>
