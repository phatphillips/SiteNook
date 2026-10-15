<script setup lang="ts">
const props = defineProps<{
  title?: string
}>()

const slots = useSlots()
const hasTitle = computed(() => Boolean(props.title || slots.title))
const hasHeaderActions = computed(() => Boolean(slots.right || slots.trailing || slots.default))
</script>

<template>
  <!--
    Title teleports into the scrolling panel body.
    Actions teleports into the app header.
    Host stays in the panel #header slot so existing call sites keep working.
  -->
  <div
    class="dashboard-page-navbar-host"
    aria-hidden="true"
  />

  <Teleport
    v-if="hasTitle"
    defer
    to="#dashboard-page-title-slot"
  >
    <h1
      v-if="!$slots.title"
      class="dashboard-page-heading"
    >
      {{ title }}
    </h1>
    <div
      v-else
      class="dashboard-page-heading"
      role="heading"
      aria-level="1"
    >
      <slot name="title" />
    </div>
  </Teleport>

  <Teleport
    v-if="hasHeaderActions"
    defer
    to="#dashboard-app-header-actions"
  >
    <div class="dashboard-app-header-actions">
      <slot name="trailing" />
      <slot />
      <slot name="right" />
    </div>
  </Teleport>
</template>
