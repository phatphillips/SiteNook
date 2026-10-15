<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { DonutChartStyle } from '~/utils/donutChart'

const props = withDefaults(defineProps<{
  /** When true, hides the Score breakdown action (no model available). */
  breakdownDisabled?: boolean
}>(), {
  breakdownDisabled: false
})

const emit = defineEmits<{
  breakdown: []
}>()

const { chartStyle, setChartStyle } = useDonutChartStyle()

function selectStyle(style: DonutChartStyle) {
  return (event: Event) => {
    event.preventDefault()
    setChartStyle(style)
  }
}

const items = computed((): DropdownMenuItem[][] => {
  const styleItems: DropdownMenuItem[] = [
    {
      label: 'Full donut',
      type: 'checkbox',
      checked: chartStyle.value === 'full',
      onSelect: selectStyle('full')
    },
    {
      label: 'Semi donut',
      type: 'checkbox',
      checked: chartStyle.value === 'semi',
      onSelect: selectStyle('semi')
    }
  ]

  if (props.breakdownDisabled) {
    return [styleItems]
  }

  return [
    styleItems,
    [{
      label: 'Score breakdown',
      icon: 'i-lucide-chart-pie',
      onSelect() {
        emit('breakdown')
      }
    }]
  ]
})
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end' }"
  >
    <UButton
      icon="i-lucide-ellipsis-vertical"
      color="neutral"
      variant="ghost"
      size="sm"
      square
      class="shrink-0"
      aria-label="Score chart options"
    />
  </UDropdownMenu>
</template>
