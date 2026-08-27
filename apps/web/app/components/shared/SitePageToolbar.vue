<script setup lang="ts">
withDefaults(defineProps<{
  showSiteSelector?: boolean
}>(), {
  showSiteSelector: false
})
</script>

<template>
  <section
    v-if="showSiteSelector || $slots.default || $slots.trailing"
    class="site-page-toolbar flex flex-wrap items-end justify-between gap-x-4 gap-y-3 rounded-lg border border-default bg-elevated/40 px-3 py-2.5"
  >
    <div
      v-if="showSiteSelector || $slots.default"
      class="flex flex-wrap items-end gap-3 min-w-0"
    >
      <SiteSelector v-if="showSiteSelector" variant="navbar" />
      <slot />
    </div>
    <div
      v-if="$slots.trailing"
      class="flex flex-wrap items-end gap-3 shrink-0"
    >
      <slot name="trailing" />
    </div>
  </section>
</template>
