<script setup lang="ts">
import type { SimulatorVisionId } from '~/utils/simulatorChecks'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { activeSiteId } = useSites()

const visionId = ref<SimulatorVisionId>('none')
const tabOrder = ref(false)

watch(siteId, (id) => {
  activeSiteId.value = id
  visionId.value = 'none'
})

onMounted(() => {
  activeSiteId.value = siteId.value
})
</script>

<template>
  <AppDashboardPanel fluid>
    <template #header>
      <DashboardPageNavbar title="Simulator">
        <template #right>
          <ScanTriggerButton :site-id="siteId" />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <AccessibilitySimulatorWorkspace
        v-model:vision-id="visionId"
        v-model:tab-order="tabOrder"
        :site-id="siteId"
      />
    </template>
  </AppDashboardPanel>
</template>
