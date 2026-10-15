<script setup lang="ts">
import {
  getVisionChecks,
  type SimulatorVisionId
} from '~/utils/simulatorChecks'

const visionId = defineModel<SimulatorVisionId>('visionId', { default: 'none' })

const visionChecks = getVisionChecks()

const items = computed(() =>
  visionChecks.map(check => ({
    label: check.shortLabel,
    value: check.id
  }))
)
</script>

<template>
  <USelect
    v-model="visionId"
    :items="items"
    value-key="value"
    size="sm"
    class="w-44"
    aria-label="Vision impairment"
  />
</template>
