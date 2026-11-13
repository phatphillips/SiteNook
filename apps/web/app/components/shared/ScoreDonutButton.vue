<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Accessible name for the control (e.g. "Open accessibility score breakdown"). */
  label: string
  disabled?: boolean
}>(), {
  disabled: false
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

function onClick(event: MouseEvent) {
  if (props.disabled) return
  emit('click', event)
}
</script>

<template>
  <button
    type="button"
    class="score-donut-button group"
    :class="{ 'score-donut-button--disabled': disabled }"
    :disabled="disabled"
    :aria-label="label"
    @click="onClick"
  >
    <slot />
    <span
      v-if="!disabled"
      class="score-donut-button__hint"
      aria-hidden="true"
    >
      <UIcon name="i-lucide-expand" class="size-3.5" />
    </span>
  </button>
</template>

<style scoped>
.score-donut-button {
  box-sizing: border-box;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 100%;
  /* Tight pad so the expand hint clears the ring; no square frame. */
  padding: 0.25rem;
  margin: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  text-align: left;
  cursor: pointer;
  overflow: visible;
  transition: transform 0.15s ease;
}

.score-donut-button > :deep(.score-donut) {
  width: 100%;
  max-width: 100%;
}

/*
 * No square border / grey plate on hover. Hover feedback lives on the donut
 * segments (halo). Keep a circular focus ring for keyboard users opening the
 * breakdown, and the small expand hint as the click affordance.
 */
.score-donut-button:not(.score-donut-button--disabled):focus-visible {
  outline: 2px solid color-mix(in srgb, var(--ui-text, #3f3f46) 35%, transparent);
  outline-offset: 4px;
}

.score-donut-button:not(.score-donut-button--disabled):active {
  transform: scale(0.99);
}

.score-donut-button--disabled {
  cursor: default;
  opacity: 0.7;
}

.score-donut-button__hint {
  pointer-events: none;
  position: absolute;
  right: 0.125rem;
  bottom: 0.125rem;
  display: inline-flex;
  width: 1.5rem;
  height: 1.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: var(--ui-bg-elevated, var(--color-background-secondary, #f4f4f5));
  color: var(--ui-text-muted, var(--color-text-secondary, #71717a));
  opacity: 0;
  box-shadow:
    0 0 0 1px var(--ui-border, rgba(24, 24, 27, 0.12)),
    0 1px 2px rgb(0 0 0 / 8%);
  transition: opacity 0.2s ease;
}

.score-donut-button:hover .score-donut-button__hint,
.score-donut-button:focus-visible .score-donut-button__hint {
  opacity: 1;
}
</style>
