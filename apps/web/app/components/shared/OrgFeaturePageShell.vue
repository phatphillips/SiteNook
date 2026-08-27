<script setup lang="ts">
defineProps<{
  title: string
  /** Use full panel width (no 70rem content cap). */
  fullWidth?: boolean
  /** Fill the dashboard panel with no max-width. */
  fluid?: boolean
}>()
</script>

<template>
  <AppDashboardPanel
    :full-width="fullWidth"
    :fluid="fluid"
  >
    <template #header>
      <DashboardPageNavbar :title="title">
        <template
          v-if="$slots.right"
          #right
        >
          <slot name="right" />
        </template>
      </DashboardPageNavbar>
    </template>
    <template #body>
      <slot />
    </template>
  </AppDashboardPanel>
</template>
