<script setup lang="ts">
import type { TrafficLight } from '~/utils/trafficLightStatus'
import { trafficLightClass } from '~/utils/trafficLightStatus'

defineProps<{
  status: TrafficLight
  label?: string
}>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5"
    :title="label"
  >
    <span
      class="size-2.5 shrink-0 rounded-full"
      :class="trafficLightClass(status)"
      aria-hidden="true"
    />
    <span v-if="label" class="sr-only">{{ label }}</span>
  </span>
</template>
