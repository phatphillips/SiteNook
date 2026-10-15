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
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  margin: 0;
  border: 2px solid transparent;
  border-radius: 1rem;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

/* Neutral grey hover/focus (not primary) — works in light and dark. */
.score-donut-button:not(.score-donut-button--disabled):hover {
  border-color: #d4d4d8;
  background-color: #f6f6f6;
  box-shadow: 0 0 0 1px rgb(24 24 27 / 8%);
}

.score-donut-button:not(.score-donut-button--disabled):focus-visible {
  border-color: #a1a1aa;
  background-color: #ececec;
  outline: none;
  box-shadow: 0 0 0 2px rgb(24 24 27 / 12%);
}

:root.dark .score-donut-button:not(.score-donut-button--disabled):hover,
.dark .score-donut-button:not(.score-donut-button--disabled):hover {
  border-color: color-mix(in srgb, white 20%, transparent);
  background-color: color-mix(in srgb, white 8%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, white 12%, transparent);
}

:root.dark .score-donut-button:not(.score-donut-button--disabled):focus-visible,
.dark .score-donut-button:not(.score-donut-button--disabled):focus-visible {
  border-color: color-mix(in srgb, white 32%, transparent);
  background-color: color-mix(in srgb, white 12%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, white 18%, transparent);
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
  right: 0.375rem;
  bottom: 0.375rem;
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
