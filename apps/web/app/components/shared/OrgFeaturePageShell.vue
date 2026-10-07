<script setup lang="ts">
defineProps<{
  title: string
  /** Kept for call-site compatibility (all panels share the 1400px content width). */
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
