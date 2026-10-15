<script setup lang="ts">
defineProps<{
  to: string
  label: string
}>()
</script>

<template>
  <NuxtLink
    :to="to"
    class="dashboard-section-view-link inline-flex shrink-0 items-center gap-1 self-end text-sm font-medium text-highlighted underline decoration-default/80 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary"
  >
    <span>{{ label }}</span>
    <UIcon
      name="i-lucide-arrow-right"
      class="size-3.5 shrink-0"
      aria-hidden="true"
    />
  </NuxtLink>
</template>
