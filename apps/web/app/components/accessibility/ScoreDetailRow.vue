<script setup lang="ts">
const props = defineProps<{
  badge: string
  badgeClass: string
  label: string
  score: number
  active?: boolean
  selected?: boolean
  tooltip?: string
}>()

const emit = defineEmits<{
  click: []
  mouseenter: []
  mouseleave: [event: MouseEvent]
  focus: []
  blur: [event: FocusEvent]
}>()

const ACCENT_BY_BADGE: Record<string, string> = {
  'site-target-badge--a': '#c2185b',
  'site-target-badge--aa': '#7b1fa2',
  'site-target-badge--aaa': '#3949ab',
  'site-target-badge--aria': '#1565c0',
  'site-target-badge--bp': '#0d47a1'
}

const barColor = computed(() => scoreRingColor(props.score))
const displayScore = computed(() => formatAccessibilityScore(props.score))
const accentColor = computed(() => ACCENT_BY_BADGE[props.badgeClass] ?? '#7b1fa2')
const fillWidth = computed(() => {
  const clamped = Math.max(0, Math.min(100, props.score))
  if (clamped <= 0) return '0%'
  return `${Math.max(clamped, 2)}%`
})

const showChevron = computed(() => props.selected || props.active)

const rowStateClass = computed(() => {
  if (props.selected) {
    return 'bg-elevated/70 border-default shadow-sm ring-1 ring-default/80'
  }
  if (props.active) {
    return 'bg-elevated/50 border-default/80'
  }
  return 'hover:bg-elevated/35 hover:border-default/60'
})

const rowStyle = computed(() => {
  if (!props.selected) return undefined
  return {
    boxShadow: `inset 3px 0 0 ${accentColor.value}, 0 1px 2px rgb(0 0 0 / 0.05)`
  }
})

function onRowClick() {
  emit('click')
}

function onHelpClick(event: MouseEvent) {
  event.stopPropagation()
}
</script>

<template>
  <button
    type="button"
    data-score-row
    class="score-detail-row group flex w-full flex-col justify-center gap-1.5 rounded-lg border border-transparent px-3 py-2.5 -mx-3 text-left transition-[background-color,border-color,box-shadow] duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :class="rowStateClass"
    :style="rowStyle"
    :aria-pressed="selected"
    @click="onRowClick"
    @mouseenter="emit('mouseenter')"
    @mouseleave="emit('mouseleave', $event)"
    @focus="emit('focus')"
    @blur="emit('blur', $event)"
  >
    <div class="flex h-5 items-center gap-2 min-w-0">
      <span class="site-target-badge shrink-0" :class="badgeClass">{{ badge }}</span>
      <span
        class="truncate flex-1 min-w-0 text-sm transition-[font-weight,color] duration-150"
        :class="selected ? 'font-semibold text-default' : active ? 'font-medium text-default' : 'text-default'"
      >{{ label }}</span>
      <UTooltip v-if="tooltip" :text="tooltip" :popper="{ placement: 'top' }">
        <span
          role="button"
          tabindex="-1"
          class="shrink-0 text-muted hover:text-default transition-colors"
          :aria-label="`About ${label}`"
          @click="onHelpClick"
        >
          <UIcon name="i-lucide-circle-help" class="size-3.5" />
        </span>
      </UTooltip>
      <UIcon
        name="i-lucide-chevron-right"
        class="size-4 shrink-0 text-muted transition-[opacity,transform,color] duration-150"
        :class="showChevron
          ? 'opacity-100 text-default translate-x-0.5'
          : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-hover:translate-x-0.5'"
        aria-hidden="true"
      />
      <span
        class="text-sm font-semibold tabular-nums shrink-0"
        :style="{ color: barColor }"
      >
        {{ displayScore }}%
      </span>
    </div>
    <div
      class="h-2 shrink-0 rounded-full overflow-hidden bg-default/60 transition-[background-color] duration-150 dark:bg-white/[0.06]"
      :class="active ? 'bg-default/80 dark:bg-white/[0.1]' : ''"
      role="presentation"
      aria-hidden="true"
    >
      <div
        class="h-full rounded-full transition-[width] duration-300"
        :style="{ width: fillWidth, backgroundColor: barColor }"
      />
    </div>
  </button>
</template>
