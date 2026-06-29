<script setup lang="ts">
const route = useRoute()
const { organization } = useTenantOrg()

const retentionBannerDismissed = ref(false)

const retentionLabel = computed(() => {
  const raw = organization.value?.purge_scheduled_at?.trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { dateStyle: 'long' })
})

const showRetentionBanner = computed(() =>
  organization.value?.status === 'closing'
  || (
    organization.value?.status === 'active'
    && organization.value?.subscription_status === 'canceled'
    && Boolean(organization.value?.purge_scheduled_at?.trim())
  )
)

const retentionBannerKey = computed(() => {
  const orgId = organization.value?.id?.trim()
  const purgeAt = organization.value?.purge_scheduled_at?.trim()
  if (!orgId || !purgeAt) return null
  return `retention-banner-dismissed:${orgId}:${purgeAt}`
})

function hydrateRetentionBannerDismissal() {
  if (!import.meta.client || !retentionBannerKey.value) {
    retentionBannerDismissed.value = false
    return
  }
  retentionBannerDismissed.value = window.localStorage.getItem(retentionBannerKey.value) === '1'
}

function dismissRetentionBanner() {
  if (!import.meta.client || !retentionBannerKey.value) {
    retentionBannerDismissed.value = true
    return
  }
  window.localStorage.setItem(retentionBannerKey.value, '1')
  retentionBannerDismissed.value = true
}

watch(retentionBannerKey, hydrateRetentionBannerDismissal, { immediate: true })

const showVisibleRetentionBanner = computed(() =>
  route.path !== '/settings/billing'
  && showRetentionBanner.value
  && !retentionBannerDismissed.value
)
</script>

<template>
  <UAlert
    v-if="showVisibleRetentionBanner"
    color="warning"
    variant="subtle"
    icon="i-lucide-triangle-alert"
    title="Account in 30-day retention"
    :description="retentionLabel
      ? `This account remains accessible until ${retentionLabel}. After that date, data is permanently deleted.`
      : 'This account remains accessible during retention and will be permanently deleted after the scheduled date.'"
    :close="{ color: 'warning', variant: 'link', class: 'p-1' }"
    class="shrink-0"
    :ui="{
      root: 'items-start gap-3',
      wrapper: 'min-w-0 flex-1',
      description: 'text-sm leading-relaxed'
    }"
    @close="dismissRetentionBanner"
  />
</template>
