<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
    <p class="mb-3 text-sm font-medium text-primary">
      SiteNook
    </p>
    <h1 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
      {{ title }}
    </h1>
    <p class="mt-4 text-base leading-relaxed text-muted sm:text-lg">
      {{ description }}
    </p>
    <div class="mt-10 rounded-xl border border-dashed border-default/80 bg-elevated/20 px-5 py-8 text-sm text-muted">
      <slot>
        This page is a placeholder. Full content will be added soon.
      </slot>
    </div>
  </div>
</template>
