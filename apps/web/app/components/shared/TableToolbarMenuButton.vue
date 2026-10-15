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
      base: activeRing
        ? 'h-8 bg-[var(--input-surface-bg)] text-[var(--input-surface-fg)] border border-[var(--input-surface-border)] ring-1 ring-primary/40 hover:bg-[var(--input-surface-hover-bg)]'
        : 'h-8 bg-[var(--input-surface-bg)] text-[var(--input-surface-fg)] border border-[var(--input-surface-border)] ring-0 hover:bg-[var(--input-surface-hover-bg)]',
      label: 'hidden lg:inline'
    }"
  />
</template>
