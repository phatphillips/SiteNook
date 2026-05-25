<script setup lang="ts">
defineProps<{
  status: string
  color?: 'error' | 'warning' | 'success' | 'info' | 'neutral'
}>()
</script>

<template>
  <UBadge :color="color || 'neutral'" variant="subtle">
    {{ status }}
  </UBadge>
</template>
