<script setup lang="ts">
import { parseMarketingSiteFlag } from '~/utils/marketingSite'

definePageMeta({
  middleware: 'home'
})

const config = useRuntimeConfig()
const route = useRoute()
const { isApexHost } = useTenantOrg()
const { isAuthenticated } = usePocketBase()

const marketingApex = computed(() =>
  parseMarketingSiteFlag(config.public.marketingSite) && isApexHost.value
)

/** Guests on marketing apex always see the public landing — including after session expiry. */
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
