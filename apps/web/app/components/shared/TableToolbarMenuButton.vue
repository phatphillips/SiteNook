<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  icon: string
  ariaLabel?: string
  activeRing?: boolean
}>(), {
  activeRing: false
})
</script>

<template>
  <UButton
    :label="label"
    :icon="icon"
    :aria-label="ariaLabel ?? label"
    color="neutral"
    variant="outline"
    size="sm"
    class="table-toolbar-menu-btn"
    :ui="activeRing ? { base: 'h-8 ring-1 ring-primary/40' } : { base: 'h-8' }"
  />
</template>
