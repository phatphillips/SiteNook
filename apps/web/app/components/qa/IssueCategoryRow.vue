<script setup lang="ts">
import {
  A11Y_BAR_FILL,
  A11Y_BAR_FILL_HOVER,
  A11Y_BAR_TRACK
} from '~/utils/chartTheme'

const props = defineProps<{
  icon: string
  /** Kept for callers; selection accent uses the shared a11y gray/purple system. */
  accentColor?: string
  label: string
  count: number
  barPercent: number
  active?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  click: []
  mouseenter: []
  mouseleave: [event: MouseEvent]
  focus: []
  blur: [event: FocusEvent]
}>()

const fillWidth = computed(() => {
  if (props.count <= 0) return '0%'
  return `${Math.max(props.barPercent, 2)}%`
})

const showChevron = computed(() => props.selected || props.active)

const rowStateClass = computed(() => {
  if (props.selected) {
    return 'bg-elevated/70 border-default shadow-sm'
  }
  if (props.active) {
    return 'bg-elevated/50 border-default'
  }
  return 'border-default/55 hover:bg-elevated/35 hover:border-default'
})

const rowStyle = computed(() => {
  const base = {
    '--bar-fill': A11Y_BAR_FILL,
    '--bar-fill-hover': A11Y_BAR_FILL_HOVER,
    '--bar-track': A11Y_BAR_TRACK
  }
  if (!props.selected) return base
  return {
    ...base,
    boxShadow: `inset 3px 0 0 ${A11Y_BAR_FILL}, 0 1px 2px rgb(0 0 0 / 0.05)`
  }
})
</script>

<template>
  <button
    type="button"
    data-score-row
    class="score-detail-row group flex w-full flex-col justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :class="[
      rowStateClass,
      {
        'score-detail-row--active': active,
        'score-detail-row--selected': selected
      }
    ]"
    :style="rowStyle"
    :aria-pressed="selected"
    @click="emit('click')"
    @mouseenter="emit('mouseenter')"
    @mouseleave="emit('mouseleave', $event)"
    @focus="emit('focus')"
    @blur="emit('blur', $event)"
  >
    <div class="flex h-5 items-center gap-2 min-w-0">
      <span
        class="inline-flex size-[18px] shrink-0 items-center justify-center rounded bg-elevated text-muted"
        aria-hidden="true"
      >
        <UIcon :name="icon" class="size-3" />
      </span>
      <span
        class="truncate flex-1 min-w-0 text-sm transition-[font-weight,color] duration-150"
        :class="selected ? 'font-semibold text-default' : active ? 'font-medium text-default' : 'text-default'"
      >{{ label }}</span>
      <UIcon
        name="i-lucide-chevron-right"
        class="size-4 shrink-0 text-muted transition-[opacity,transform,color] duration-150"
        :class="showChevron
          ? 'opacity-100 text-default translate-x-0.5'
          : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-hover:translate-x-0.5'"
        aria-hidden="true"
      />
      <span class="text-sm font-semibold tabular-nums shrink-0 text-highlighted">
        {{ count.toLocaleString() }}
      </span>
    </div>
    <div
      class="score-detail-row__track relative h-2.5 shrink-0 overflow-hidden rounded transition-[background-color] duration-150"
      role="presentation"
      aria-hidden="true"
    >
      <div
        class="score-detail-row__bar absolute inset-y-0 left-0 rounded"
        :style="{ width: fillWidth }"
      />
    </div>
  </button>
</template>

<style scoped>
.score-detail-row__track {
  background-color: var(--bar-track);
  transform-origin: left center;
  transition: transform 380ms cubic-bezier(0.34, 1.45, 0.64, 1);
}

.score-detail-row:hover .score-detail-row__track,
.score-detail-row:focus-visible .score-detail-row__track,
.score-detail-row--active .score-detail-row__track,
.score-detail-row--selected .score-detail-row__track {
  transform: scale(1.012);
}

.score-detail-row__bar {
  background-color: var(--bar-fill);
  transition:
    background-color 180ms ease,
    width 300ms ease;
}

.score-detail-row:hover .score-detail-row__bar,
.score-detail-row:focus-visible .score-detail-row__bar,
.score-detail-row--active .score-detail-row__bar,
.score-detail-row--selected .score-detail-row__bar {
  background-color: var(--bar-fill-hover);
}
</style>
