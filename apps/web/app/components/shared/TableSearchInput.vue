<script setup lang="ts">
const model = defineModel<string>({ default: '' })

withDefaults(defineProps<{
  placeholder?: string
  ariaLabel?: string
}>(), {
  placeholder: 'Search…',
  ariaLabel: 'Search'
})
</script>

<template>
  <UInput
    v-model="model"
    icon="i-lucide-search"
    :placeholder="placeholder"
    :aria-label="ariaLabel"
    size="sm"
    class="table-search-input shrink-0 w-44 sm:w-56"
    :ui="{
      root: 'relative inline-flex items-center w-auto h-8',
      base: 'h-8 min-h-8 py-0 text-sm text-default bg-elevated ring-muted placeholder:text-muted',
      leading: 'ps-2.5',
      leadingIcon: 'size-4 text-muted'
    }"
  />
</template>
