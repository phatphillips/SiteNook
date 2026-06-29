<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section class="border-b border-default/70 py-6 last:border-b-0">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 space-y-1">
        <h2 class="text-base font-semibold text-highlighted">
          {{ title }}
        </h2>
        <p
          v-if="description"
          class="text-sm text-muted leading-relaxed max-w-2xl"
        >
          {{ description }}
        </p>
        <slot name="meta" />
      </div>
      <div
        v-if="$slots.action"
        class="shrink-0"
      >
        <slot name="action" />
      </div>
    </div>
    <div
      v-if="$slots.default"
      class="mt-4"
    >
      <slot />
    </div>
  </section>
</template>
