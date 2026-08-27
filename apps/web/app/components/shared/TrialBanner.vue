<script setup lang="ts">
import { daysRemainingUntil } from '~/utils/planPricing'
import { trackFunnelEvent } from '~/utils/funnelAnalytics'

const route = useRoute()
const { organization } = useTenantOrg()

const dismissed = ref(false)

const trialEndsAt = computed(() => organization.value?.trial_ends_at?.trim() || '')
const isTrialing = computed(() =>
  organization.value?.subscription_status === 'trialing' && Boolean(trialEndsAt.value)
)

const daysLeft = computed(() => daysRemainingUntil(trialEndsAt.value))

const bannerKey = computed(() => {
  const orgId = organization.value?.id?.trim()
  if (!orgId || !trialEndsAt.value) return null
  return `trial-banner-dismissed:${orgId}:${trialEndsAt.value}`
})

function hydrateDismissal() {
  if (!import.meta.client || !bannerKey.value) {
    dismissed.value = false
    return
  }
  dismissed.value = window.localStorage.getItem(bannerKey.value) === '1'
}

function dismiss() {
  if (import.meta.client && bannerKey.value) {
    window.localStorage.setItem(bannerKey.value, '1')
  }
  dismissed.value = true
}

watch(bannerKey, hydrateDismissal, { immediate: true })

const showBanner = computed(() =>
  route.path !== '/settings/billing'
  && isTrialing.value
  && !dismissed.value
  && daysLeft.value !== null
)

const description = computed(() => {
  const days = daysLeft.value
  if (days === null) return ''
  if (days <= 0) {
    return 'Your Team trial ends today. Upgrade to keep scheduled scans, SEO, and higher limits — annual billing saves about 15%.'
  }
  if (days === 1) {
    return '1 day left on your Team trial. Upgrade to keep scheduled scans, SEO, and higher limits.'
  }
  return `${days} days left on your Team trial. Keep scheduled scans, SEO, and readability — annual billing saves about 15%.`
})

function onUpgradeClick() {
  trackFunnelEvent('upgrade_click', {
    organizationId: organization.value?.id,
    source: 'trial_banner'
  })
}
</script>

<template>
  <UAlert
    v-if="showBanner"
    color="info"
    variant="subtle"
    icon="i-lucide-sparkles"
    title="Team trial"
    :description="description"
    :close="{ color: 'info', variant: 'link', class: 'p-1' }"
    class="shrink-0"
    :ui="{
      root: 'items-start gap-3',
      wrapper: 'min-w-0 flex-1',
      description: 'text-sm leading-relaxed'
    }"
    @close="dismiss"
  >
    <template #actions>
      <UButton
        to="/settings/billing"
        size="xs"
        color="neutral"
        @click="onUpgradeClick"
      >
        Upgrade
      </UButton>
    </template>
  </UAlert>
</template>
