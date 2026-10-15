<script setup lang="ts">
import { formatAccessibilityScore } from '~/utils/siteimproveScore'
import {
  A11Y_BAR_FILL,
  A11Y_BAR_FILL_HOVER,
  A11Y_BAR_TEXT,
  A11Y_BAR_TEXT_ON_FILL,
  A11Y_BAR_TEXT_ON_HOVER,
  A11Y_BAR_TRACK
} from '~/utils/chartTheme'

const props = defineProps<{
  score: number
  to: string
}>()

const scorePct = computed(() =>
  `${Math.max(0, Math.min(100, props.score))}%`
)

const chipStyle = computed(() => ({
  '--bar-fill': A11Y_BAR_FILL,
  '--bar-fill-hover': A11Y_BAR_FILL_HOVER,
  '--bar-track': A11Y_BAR_TRACK,
  '--bar-text': A11Y_BAR_TEXT,
  '--bar-text-on-fill': A11Y_BAR_TEXT_ON_FILL,
  '--bar-text-hover': A11Y_BAR_TEXT_ON_HOVER,
  '--score-pct': scorePct.value
}))

const label = computed(() => `${formatAccessibilityScore(props.score)}%`)
</script>

<template>
  <NuxtLink
    :to="to"
    class="a11y-score-chip group relative flex h-8 w-full items-center justify-center overflow-hidden rounded-md text-sm font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :style="chipStyle"
  >
    <span class="a11y-score-chip__track absolute inset-0 rounded-md" aria-hidden="true" />
    <span
      class="a11y-score-chip__bar absolute inset-y-0 left-0 rounded-md"
      :style="{ width: 'var(--score-pct)' }"
      aria-hidden="true"
    />
    <span class="a11y-score-chip__text a11y-score-chip__text--base absolute inset-0 z-10 flex items-center justify-center">
      {{ label }}
    </span>
    <span
      class="a11y-score-chip__text a11y-score-chip__text--on-fill absolute inset-0 z-20 flex items-center justify-center"
      aria-hidden="true"
    >
      {{ label }}
    </span>
  </NuxtLink>
</template>

<style scoped>
.a11y-score-chip__track {
  background-color: var(--bar-track);
}

.a11y-score-chip__bar {
  background-color: var(--bar-fill);
  transition: background-color 180ms ease;
}

.a11y-score-chip:hover .a11y-score-chip__bar,
.a11y-score-chip:focus-visible .a11y-score-chip__bar {
  background-color: var(--bar-fill-hover);
}

.a11y-score-chip__text--base {
  color: var(--bar-text);
  clip-path: inset(0 0 0 var(--score-pct));
}

.a11y-score-chip__text--on-fill {
  color: var(--bar-text-on-fill);
  clip-path: inset(0 calc(100% - var(--score-pct)) 0 0);
  pointer-events: none;
}

.a11y-score-chip:hover .a11y-score-chip__text--on-fill,
.a11y-score-chip:focus-visible .a11y-score-chip__text--on-fill {
  color: var(--bar-text-hover);
}
</style>
