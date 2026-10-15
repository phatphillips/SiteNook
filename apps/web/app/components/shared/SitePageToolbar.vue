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
    class="site-page-toolbar flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
  >
    <div
      v-if="showSiteSelector || $slots.default"
      class="flex min-w-0 flex-wrap items-center gap-3"
    >
      <SiteSelector v-if="showSiteSelector" variant="navbar" />
      <slot />
    </div>
    <div
      v-if="$slots.trailing"
      class="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3"
    >
      <slot name="trailing" />
    </div>
  </section>
</template>
