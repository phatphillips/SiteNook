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
  <header
    class="feature-page-intro min-w-0"
    :aria-labelledby="titleId"
  >
    <h2
      :id="titleId"
      class="text-base font-semibold text-highlighted sm:text-lg"
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
      class="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted"
    >
      {{ props.description }}
    </p>
    <div
      v-if="$slots.actions"
      class="mt-3 flex flex-wrap items-center gap-2"
    >
      <slot name="actions" />
    </div>
  </header>
</template>
