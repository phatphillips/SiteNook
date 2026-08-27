<script setup lang="ts">
const props = defineProps<{
  title: string
  description?: string
}>()

const titleId = useId()
const slots = useSlots()
const hasDescriptionSlot = computed(() => Boolean(slots.description))
</script>

<template>
  <section
    class="feature-page-banner flex items-stretch overflow-hidden rounded-xl border border-default bg-elevated/40 px-5 sm:px-6"
    :class="{ 'feature-page-banner--interactive': hasDescriptionSlot || $slots.actions }"
    :aria-labelledby="titleId"
  >
    <div class="flex min-w-0 flex-1 flex-col justify-center py-4 sm:py-5">
      <h2
        :id="titleId"
        class="text-base font-semibold sm:text-lg"
      >
        {{ props.title }}
      </h2>
      <div
        v-if="hasDescriptionSlot"
        class="mt-1.5"
      >
        <slot name="description" />
      </div>
      <p
        v-else-if="props.description"
        class="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted"
      >
        {{ props.description }}
      </p>
      <div
        v-if="$slots.actions"
        class="mt-2 flex flex-wrap items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.feature-page-banner {
  height: calc(var(--spacing) * 30);
}

.feature-page-banner--interactive {
  height: auto;
  min-height: calc(var(--spacing) * 30);
}
</style>
