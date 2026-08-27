<script setup lang="ts">
import type { BlogCategory } from '~/utils/blog'
import { BLOG_CATEGORIES } from '~/utils/blog'

defineProps<{
  modelValue: BlogCategory | 'all'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BlogCategory | 'all']
}>()
</script>

<template>
  <div
    class="flex flex-wrap gap-1.5"
    role="tablist"
    aria-label="Filter posts by category"
  >
    <button
      v-for="item in BLOG_CATEGORIES"
      :key="item.value"
      type="button"
      role="tab"
      class="min-h-9 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      :class="modelValue === item.value
        ? 'bg-elevated text-highlighted ring-1 ring-default'
        : 'text-muted hover:bg-elevated/60 hover:text-highlighted'"
      :aria-selected="modelValue === item.value"
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
