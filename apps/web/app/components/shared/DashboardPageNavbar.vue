<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <UDashboardNavbar :toggle="false">
    <template #title>
      <div class="flex items-center gap-3 min-w-0">
        <UDashboardSidebarCollapse />
        <h1 class="truncate shrink-0">
          <slot name="title">{{ title }}</slot>
        </h1>
      </div>
    </template>
    <template v-if="$slots.trailing" #trailing>
      <slot name="trailing" />
    </template>
    <template v-if="$slots.right" #right>
      <slot name="right" />
    </template>
    <slot />
  </UDashboardNavbar>
</template>
