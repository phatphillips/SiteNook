<script setup lang="ts">
import {
  getIndependentChecks,
  getSimulatorCheck,
  getVisionChecks,
  type SimulatorVisionId
} from '~/utils/simulatorChecks'

const visionId = defineModel<SimulatorVisionId>('visionId', { default: 'none' })
const tabOrder = defineModel<boolean>('tabOrder', { default: false })

const visionChecks = getVisionChecks()
const independentChecks = getIndependentChecks()

const activeDescription = computed(() => {
  const parts: string[] = []
  if (visionId.value !== 'none') {
    parts.push(getSimulatorCheck(visionId.value).description)
  }
  if (tabOrder.value) {
    parts.push(getSimulatorCheck('tab_order').description)
  }
  if (!parts.length) {
    return getSimulatorCheck('none').description
  }
  return parts.join(' ')
})

const activeTitle = computed(() => {
  const labels: string[] = []
  if (visionId.value !== 'none') {
    labels.push(getSimulatorCheck(visionId.value).label)
  }
  if (tabOrder.value) {
    labels.push(getSimulatorCheck('tab_order').label)
  }
  return labels.length ? labels.join(' + ') : getSimulatorCheck('none').label
})

function selectVision(id: SimulatorVisionId) {
  visionId.value = visionId.value === id && id !== 'none' ? 'none' : id
}

function toggleTabOrder() {
  tabOrder.value = !tabOrder.value
}
</script>

<template>
  <section class="rounded-lg border border-default bg-elevated/25 p-4 sm:p-5 space-y-4">
    <div>
      <h2 class="text-sm font-semibold text-default">Simulation checks</h2>
      <p class="text-xs text-muted mt-1">
        Toggle a vision impairment and optionally show keyboard tab order. Vision modes are exclusive;
        tab order can combine with any mode.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="check in visionChecks"
        :key="check.id"
        size="sm"
        :color="visionId === check.id ? 'primary' : 'neutral'"
        :variant="visionId === check.id ? 'solid' : 'outline'"
        :label="check.shortLabel"
        @click="selectVision(check.id as SimulatorVisionId)"
      />
      <UButton
        v-for="check in independentChecks"
        :key="check.id"
        size="sm"
        :color="tabOrder ? 'primary' : 'neutral'"
        :variant="tabOrder ? 'solid' : 'outline'"
        :label="check.shortLabel"
        icon="i-lucide-keyboard"
        @click="toggleTabOrder"
      />
    </div>

    <div class="rounded-md border border-default/80 bg-default/40 px-3 py-2.5 space-y-1">
      <p class="text-xs font-medium uppercase tracking-wide text-muted">
        {{ activeTitle }}
      </p>
      <p class="text-sm text-default">
        {{ activeDescription }}
      </p>
    </div>
  </section>
</template>
