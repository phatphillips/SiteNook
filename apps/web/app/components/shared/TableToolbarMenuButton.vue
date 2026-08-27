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
    class="table-toolbar-menu-btn max-lg:aspect-square max-lg:!px-2"
    :ui="{
      base: activeRing ? 'h-8 ring-1 ring-primary/40' : 'h-8',
      label: 'hidden lg:inline'
    }"
  />
</template>
