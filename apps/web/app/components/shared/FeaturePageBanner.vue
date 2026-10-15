<script setup lang="ts">
const props = defineProps<{
  description?: string
}>()

const slots = useSlots()
const hasDescriptionSlot = computed(() => Boolean(slots.description))
const hasDescription = computed(() => hasDescriptionSlot.value || Boolean(props.description))
</script>

<template>
  <div
    v-if="hasDescription || $slots.actions"
    class="feature-page-intro min-w-0"
  >
    <div
      v-if="hasDescriptionSlot"
    >
      <slot name="description" />
    </div>
    <p
      v-else-if="props.description"
      class="max-w-3xl text-sm leading-relaxed text-muted"
    >
      {{ props.description }}
    </p>
    <div
      v-if="$slots.actions"
      class="mt-3 flex flex-wrap items-center gap-2"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
