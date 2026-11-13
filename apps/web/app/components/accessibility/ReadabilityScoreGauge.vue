<script setup lang="ts">
import type { ReadabilityMethodId } from '~/utils/readabilityMethods'
import { formatReadabilityScoreDisplay, getReadabilityMethod } from '~/utils/readabilityMethods'

const props = defineProps<{
  methodId: ReadabilityMethodId
  /** Gauge position 0–100 (0 = easy/green, 100 = hard/red). */
  position: number | null
  /** Site-average raw score for the active method. */
  rawScore?: number | null
}>()

const method = computed(() => getReadabilityMethod(props.methodId))

const markerLeft = computed(() => {
  if (props.position == null) return '0%'
  return `${Math.max(0, Math.min(100, props.position))}%`
})

const displayValue = computed(() =>
  formatReadabilityScoreDisplay(props.methodId, props.rawScore)
)

const markerValue = computed(() => {
  if (props.rawScore != null) {
    return formatReadabilityScoreDisplay(props.methodId, props.rawScore).split(' · ')[0]
  }
  if (props.position != null) return props.position.toFixed(1)
  return '—'
})
</script>

<template>
  <div class="readability-gauge space-y-2">
    <div class="flex items-baseline justify-between gap-4">
      <p class="text-2xl font-semibold tabular-nums text-default">
        {{ displayValue }}
      </p>
      <p class="text-sm text-muted text-right shrink-0">
        Site average · {{ method.shortLabel }}
      </p>
    </div>

    <div class="relative pt-6 pb-1">
      <div
        class="readability-gauge__bar h-3 w-full rounded-full"
        role="img"
        :aria-label="`Readability gauge at ${displayValue} for ${method.label}`"
      />
      <div
        v-if="position != null"
        class="readability-gauge__marker absolute top-0 flex flex-col items-center -translate-x-1/2"
        :style="{ left: markerLeft }"
      >
        <span class="text-xs font-medium tabular-nums text-default mb-0.5">{{ markerValue }}</span>
        <span class="readability-gauge__needle" />
      </div>
    </div>

    <div class="flex justify-between text-xs text-muted tabular-nums px-0.5">
      <span>0</span>
      <span>10</span>
      <span>20</span>
      <span>30</span>
      <span>40</span>
      <span>50</span>
      <span>60</span>
      <span>70</span>
      <span>80</span>
      <span>90</span>
      <span>100</span>
    </div>
    <p class="text-xs text-muted">
      Lower values indicate easier reading. Scale is normalized for comparison across methods.
    </p>
  </div>
</template>

<style scoped>
.readability-gauge__bar {
  background: linear-gradient(
    to right,
    #22c55e 0%,
    #84cc16 18%,
    #eab308 38%,
    #f97316 58%,
    #ef4444 78%,
    #991b1b 100%
  );
}

.readability-gauge__needle {
  display: block;
  width: 2px;
  height: 20px;
  background: #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
}

.readability-gauge__marker::after {
  content: '';
  display: block;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid #fff;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.35));
  margin-top: -1px;
}
</style>
