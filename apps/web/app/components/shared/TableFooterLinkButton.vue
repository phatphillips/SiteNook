<script setup lang="ts">
defineProps<{
  to: string
  label: string
}>()
</script>

<template>
  <NuxtLink
    :to="to"
    class="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-default bg-elevated/50 px-3.5 py-1.5 text-sm font-medium text-default transition-colors hover:bg-elevated hover:border-muted"
  >
    {{ label }}
    <UIcon name="i-lucide-chevron-right" class="size-4 opacity-80" />
  </NuxtLink>
</template>
