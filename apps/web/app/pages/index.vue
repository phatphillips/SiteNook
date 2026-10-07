<script setup lang="ts">
import { isMarketingSiteActive } from '~/utils/marketingSite'

definePageMeta({
  middleware: 'home'
})

const config = useRuntimeConfig()
const route = useRoute()
const { isApexHost } = useTenantOrg()
const { isAuthenticated } = usePocketBase()

const marketingApex = computed(() =>
  isMarketingSiteActive(config.public.marketingSite, config.public.commercialEnabled)
  && isApexHost.value
)

/** Guests on marketing apex always see the public landing. Including after session expiry. */
const showMarketingLanding = computed(() => {
  if (route.meta.marketingLanding === true) return true
  if (marketingApex.value && !isAuthenticated.value) return true
  return false
})

watch(showMarketingLanding, (show) => {
  if (!import.meta.client) return
  setPageLayout(show ? 'marketing' : 'default')
}, { immediate: true })
</script>

<template>
  <MarketingLandingPage v-if="showMarketingLanding" />
  <HomeDashboard v-else />
</template>
