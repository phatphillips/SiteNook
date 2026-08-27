<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/sitenook'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

const props = defineProps<{
  score: number
  label?: string
  size?: 'sm' | 'lg'
  variant?: 'default' | 'site-target'
  /** Override arc/value color (defaults to score severity ring color). */
  ringColor?: string
  /**
   * When true, hovering swaps the score arc to severity color (green/amber/red).
   */
  severityHover?: boolean
  /**
   * When true, hovering slightly scales the rings and thickens the score arc
   * without changing its color.
   */
  hoverZoom?: boolean
  /** Main chart: show "Overall score" + calculation tooltip */
  showOverallLabel?: boolean
  /** Open issues for impact breakdown ring (main chart). */
  impactIssues?: AccessibilityIssue[]
  /** Formatted delta since previous scan (e.g. "+1.3", "-0.1"). */
  delta?: string | null
  deltaTooltip?: string
  /** Potential overall score while hovering a conformance row (site-target variant). */
  potentialScore?: number | null
  /** Show a subtle updating indicator (site-target variant). */
  scoreUpdating?: boolean
}>()

const SCORE_TOOLTIP =
  'Overall accessibility score uses the Siteimprove model: 90 points for WCAG checks (weighted by level A / AA / AAA) and 10 for best practices, with progress based on failed vs total occurrences per check and a logarithmic curve near 100%.'

const IMPACT_COLORS: Record<string, string> = {
  critical: '#ef4444',
  serious: '#f97316',
  moderate: '#eab308',
  minor: '#a78bfa'
}

const TRACK_COLOR = 'rgba(255, 255, 255, 0.06)'

const hovered = ref(false)

const hoverInteractive = computed(() => props.severityHover || props.hoverZoom)

const color = computed(() => {
  if (props.severityHover && hovered.value) {
    return scoreRingColor(props.score)
  }
  return props.ringColor ?? scoreRingColor(props.score)
})

function onDonutEnter() {
  if (!hoverInteractive.value) return
  hovered.value = true
}

function onDonutLeave() {
  if (!hoverInteractive.value) return
  hovered.value = false
}

const impactSegments = computed((): DonutSegment[] => {
  if (!props.impactIssues?.length) return []
  const counts: Record<string, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0
  }
  for (const issue of props.impactIssues) {
    counts[issue.impact] = (counts[issue.impact] ?? 0) + 1
  }
  return (['critical', 'serious', 'moderate', 'minor'] as const)
    .filter(key => counts[key]! > 0)
    .map(key => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value: counts[key]!,
      color: IMPACT_COLORS[key]!
    }))
})

const RADIUS = 42
const IMPACT_RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const IMPACT_CIRCUMFERENCE = 2 * Math.PI * IMPACT_RADIUS
const SEGMENT_GAP = 3

const isSiteTarget = computed(() => props.variant === 'site-target')

const strokeWidth = computed(() => (props.size === 'sm' ? 7 : 9))
const impactStrokeWidth = 4

const CENTER = 50
const ringCircleProps = computed(() => ({
  cx: CENTER,
  cy: CENTER,
  r: RADIUS,
  fill: 'none' as const,
  'stroke-width': strokeWidth.value,
  'stroke-linecap': 'butt' as const
}))

const normalizedScore = computed(() =>
  Math.max(0, Math.min(100, props.score))
)

function scoreArcSegment(fromPercent: number, toPercent: number) {
  const from = Math.max(0, Math.min(100, fromPercent))
  const to = Math.max(from, Math.min(100, toPercent))
  const segmentLength = ((to - from) / 100) * CIRCUMFERENCE
  if (segmentLength <= 0) {
    return { dashArray: `0 ${CIRCUMFERENCE}`, dashOffset: 0, visible: false }
  }
  const skipLength = (from / 100) * CIRCUMFERENCE
  return {
    dashArray: `${segmentLength} ${CIRCUMFERENCE - segmentLength}`,
    dashOffset: -skipLength,
    visible: true
  }
}

const scoreArc = computed(() => {
  const scored = normalizedScore.value
  const capCorrection = strokeWidth.value

  if (scored >= 100) {
    return { dashArray: `${CIRCUMFERENCE}`, dashOffset: 0, visible: true }
  }
  if (scored <= 0) {
    return { dashArray: `0 ${CIRCUMFERENCE}`, dashOffset: 0, visible: false }
  }
  const filled = (CIRCUMFERENCE * scored) / 100
  const dashLength = Math.max(0.01, filled - capCorrection)
  return {
    dashArray: `${dashLength} ${CIRCUMFERENCE - dashLength}`,
    dashOffset: 0,
    visible: true
  }
})

const normalizedPotential = computed(() => {
  const potential = props.potentialScore
  if (potential == null) return null
  return Math.max(0, Math.min(100, potential))
})

const showPotentialGain = computed(() => {
  if (!isSiteTarget.value || normalizedPotential.value == null) return false
  return normalizedPotential.value > normalizedScore.value + 0.05
})

const gainArc = computed(() => {
  if (!showPotentialGain.value || normalizedPotential.value == null) {
    return { dashArray: `0 ${CIRCUMFERENCE}`, dashOffset: 0, visible: false }
  }
  return scoreArcSegment(normalizedScore.value, normalizedPotential.value)
})

const gainArcColor = computed(() => {
  const base = color.value
  return `${base}66`
})

const impactArcs = computed(() => {
  const segments = impactSegments.value
  if (!segments.length) return []

  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  if (total <= 0) return []

  let offset = 0
  return segments.map((segment) => {
    const fraction = segment.value / total
    const arcLength = Math.max(0, IMPACT_CIRCUMFERENCE * fraction - SEGMENT_GAP)
    const dashOffset = -offset
    offset += IMPACT_CIRCUMFERENCE * fraction
    return {
      color: segment.color,
      dashArray: `${arcLength} ${IMPACT_CIRCUMFERENCE - arcLength}`,
      dashOffset
    }
  })
})

const sizeClass = computed(() => {
  if (isSiteTarget.value) return 'size-52'
  return props.size === 'sm' ? 'size-20' : 'size-40'
})
const isLarge = computed(() => props.size !== 'sm' || isSiteTarget.value)

const displayScore = computed(() => formatAccessibilityScore(props.score))
const displayPotentialScore = computed(() =>
  normalizedPotential.value == null
    ? null
    : formatAccessibilityScore(normalizedPotential.value)
)
const showImpactRing = computed(() =>
  !isSiteTarget.value && props.showOverallLabel && impactSegments.value.length > 0
)

const deltaClass = computed(() => {
  if (!props.delta) return 'text-muted'
  if (props.delta.startsWith('+')) return 'text-success'
  if (props.delta.startsWith('-')) return 'text-error'
  return 'text-muted'
})

const ariaLabel = computed(() => {
  if (props.label) return `${props.label} score ${displayScore.value}`
  if (isSiteTarget.value) {
    const deltaPart = props.delta ? `, change ${props.delta}` : ''
    return `Site score ${displayScore.value} percent${deltaPart}`
  }
  return `Overall score ${displayScore.value}`
})
</script>

<template>
  <div
    class="score-donut relative inline-flex flex-col items-center"
    :class="[sizeClass, { 'score-donut--interactive': hoverInteractive, 'score-donut--hovered': hoverInteractive && hovered }]"
    @mouseenter="onDonutEnter"
    @mouseleave="onDonutLeave"
  >
    <svg
      class="size-full"
      viewBox="0 0 100 100"
      role="img"
      :aria-label="ariaLabel"
    >
      <g class="score-donut-rings-group">
        <circle
          v-bind="ringCircleProps"
          :stroke="TRACK_COLOR"
          class="score-donut-track"
        />
        <circle
          v-if="scoreArc.visible"
          v-bind="ringCircleProps"
          :stroke="color"
          :stroke-width="hoverInteractive && hovered ? strokeWidth + 1.5 : strokeWidth"
          stroke-linecap="round"
          class="score-donut-arc"
          :stroke-dasharray="scoreArc.dashArray"
          :stroke-dashoffset="scoreArc.dashOffset"
          :transform="`rotate(-90 ${CENTER} ${CENTER})`"
        />
      </g>
      <circle
        v-if="gainArc.visible"
        v-bind="ringCircleProps"
        :stroke="gainArcColor"
        stroke-linecap="round"
        class="score-donut-gain"
        :stroke-dasharray="gainArc.dashArray"
        :stroke-dashoffset="gainArc.dashOffset"
        :transform="`rotate(-90 ${CENTER} ${CENTER})`"
      />
      <template v-if="showImpactRing">
        <circle
          v-for="(arc, index) in impactArcs"
          :key="`impact-${index}`"
          cx="50"
          cy="50"
          :r="IMPACT_RADIUS"
          fill="none"
          :stroke="arc.color"
          :stroke-width="impactStrokeWidth"
          stroke-linecap="round"
          :stroke-dasharray="arc.dashArray"
          :stroke-dashoffset="arc.dashOffset"
          transform="rotate(-90 50 50)"
        />
      </template>
    </svg>
    <div class="score-donut-center absolute inset-0 flex flex-col items-center justify-center px-2 text-center pointer-events-none">
      <template v-if="isSiteTarget">
        <template v-if="showPotentialGain && displayPotentialScore">
          <span class="text-base font-semibold text-highlighted">Could be</span>
          <span class="score-donut-value font-bold leading-none text-4xl mt-0.5">
            {{ displayPotentialScore }}%
          </span>
        </template>
        <template v-else>
          <div class="flex items-center gap-1.5">
            <span class="text-base font-semibold text-highlighted">Site score</span>
            <span
              v-if="scoreUpdating"
              class="inline-flex items-center gap-1 text-xs font-medium text-muted"
              role="status"
              aria-live="polite"
            >
              <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
            </span>
          </div>
          <span class="score-donut-value font-bold leading-none text-4xl mt-0.5">
            {{ displayScore }}%
          </span>
        </template>
        <div
          v-if="delta && !showPotentialGain"
          class="score-donut-delta mt-1.5 flex items-center gap-1 text-sm font-medium pointer-events-auto"
          :class="deltaClass"
        >
          <span>{{ delta }}</span>
          <UTooltip
            v-if="deltaTooltip"
            :text="deltaTooltip"
            :popper="{ placement: 'bottom' }"
          >
            <button
              type="button"
              class="text-muted hover:text-default transition-colors"
              aria-label="About score change"
            >
              <UIcon name="i-lucide-circle-help" class="size-3.5" />
            </button>
          </UTooltip>
        </div>
      </template>
      <template v-else>
        <span
          class="score-donut-value font-bold leading-none"
          :class="size === 'sm' ? 'text-lg' : 'text-3xl'"
        >{{ displayScore }}%</span>
        <span v-if="label" class="text-xs text-muted mt-0.5">{{ label }}</span>
        <template v-else-if="showOverallLabel && isLarge">
          <span class="text-xs text-muted mt-1">Overall score</span>
          <UTooltip :text="SCORE_TOOLTIP" :popper="{ placement: 'bottom' }">
            <button
              type="button"
              class="mt-1 text-muted hover:text-default transition-colors pointer-events-auto"
              aria-label="How overall score is calculated"
            >
              <UIcon name="i-lucide-info" class="size-3.5" />
            </button>
          </UTooltip>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.score-donut--interactive {
  cursor: default;
}

.score-donut-arc {
  transition:
    stroke 320ms cubic-bezier(0.22, 1, 0.36, 1),
    stroke-dasharray 320ms cubic-bezier(0.22, 1, 0.36, 1),
    stroke-dashoffset 320ms cubic-bezier(0.22, 1, 0.36, 1),
    stroke-width 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.score-donut-gain {
  transition:
    stroke 320ms cubic-bezier(0.22, 1, 0.36, 1),
    stroke-dasharray 320ms cubic-bezier(0.22, 1, 0.36, 1),
    stroke-dashoffset 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.score-donut-rings-group {
  transform-box: view-box;
  transform-origin: 50% 50%;
  transition: transform 380ms cubic-bezier(0.34, 1.45, 0.64, 1);
}

.score-donut--hovered .score-donut-rings-group {
  transform: scale(1.045);
}

.score-donut-track {
  transition: stroke-width 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.score-donut-center {
  transform-box: border-box;
  transform-origin: center center;
  transition: transform 380ms cubic-bezier(0.34, 1.45, 0.64, 1);
}

.score-donut--hovered .score-donut-center {
  transform: scale(1.045);
}

.score-donut-value {
  display: inline-block;
}
</style>
