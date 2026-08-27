<script setup lang="ts">
import type { WcagLevelFilter } from '~/types/sitenook'

defineProps<{
  modelValue: WcagLevelFilter
  counts: Record<WcagLevelFilter, number>
}>()

const emit = defineEmits<{ 'update:modelValue': [WcagLevelFilter] }>()

const levels: WcagLevelFilter[] = ['All', 'A', 'AA', 'AAA']

function select(level: WcagLevelFilter) {
  emit('update:modelValue', level)
  const route = useRoute()
  navigateTo({ query: { ...route.query, level: level === 'All' ? undefined : level } })
}

function badgeColor(level: WcagLevelFilter) {
  if (level === 'A') return 'error'
  if (level === 'AA' || level === 'AAA') return 'warning'
  return 'neutral'
}
</script>

<template>
  <div class="flex rounded-lg border border-default overflow-hidden">
    <button
      v-for="level in levels"
      :key="level"
      type="button"
      class="flex-1 px-4 py-3 text-center transition-colors border-r border-default last:border-r-0"
      :class="modelValue === level ? 'bg-elevated font-semibold' : 'hover:bg-elevated/50'"
      @click="select(level)"
    >
      <div class="text-sm">{{ level }}</div>
      <UBadge :color="badgeColor(level)" variant="subtle" class="mt-1">
        {{ counts[level] }}
      </UBadge>
    </button>
  </div>
</template>
