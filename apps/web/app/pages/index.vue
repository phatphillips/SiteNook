<script setup lang="ts">
definePageMeta({
  middleware: 'home'
})

const route = useRoute()
const showMarketingLanding = computed(() => route.meta.marketingLanding === true)
</script>

<template>
  <MarketingLandingPage v-if="showMarketingLanding" />
  <MarketingHomeDashboard v-else />
</template>
