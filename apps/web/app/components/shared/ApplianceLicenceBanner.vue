<script setup lang="ts">
import type { ApplianceLicenceStatusDto } from '~/types/applianceLicence'

const config = useRuntimeConfig()
const isAppliance = computed(() => {
  const mode = String(config.public.deploymentMode || '').toLowerCase()
  return mode === 'appliance' || mode === 'selfhost' || mode === 'community'
})

const status = ref<ApplianceLicenceStatusDto | null>(null)

onMounted(async () => {
  if (!isAppliance.value) return
  try {
    status.value = await $fetch<ApplianceLicenceStatusDto>('/api/licence/status')
  } catch {
    status.value = null
  }
})

const showBanner = computed(() =>
  isAppliance.value && status.value?.upgradeRequired === true
)
</script>

<template>
  <UAlert
    v-if="showBanner && status"
    class="rounded-none border-x-0 border-t-0"
    color="warning"
    variant="subtle"
    title="Community edition"
    :description="status.message"
  >
    <template #actions>
      <UButton
        size="xs"
        color="primary"
        to="/settings/billing"
      >
        Activate licence
      </UButton>
    </template>
  </UAlert>
</template>
