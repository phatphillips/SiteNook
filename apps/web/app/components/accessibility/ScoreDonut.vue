<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/sitenook'
import {
  DEFAULT_DONUT_CHART_STYLE,
  DONUT_SEGMENT_TOKENS,
  DONUT_VIEWBOX,
  donutRingGeometry,
  layoutDonutSegments,
  scoreDonutSegments,
  semiDonutRingGeometry,
  type DonutChartStyle,
  type DonutSegmentInput
} from '~/utils/donutChart'

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
  /** Override score segment colour (defaults to --donut-segment-1 / primary). */
  ringColor?: string
  /**
   * When true, hovering swaps the score arc to severity color (green/amber/red).
   */
  severityHover?: boolean
  /**
   * When true, hovering slightly scales the ring without changing its color.
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
  /** Optional unit shown on the value baseline (default "%"). */
  unit?: string
  /** Centre caption under the value (overrides default site/overall labels). */
  caption?: string
  /**
   * Optional custom donut slices (breakdown modal). When set, replaces the
   * default score-vs-remaining progress ring.
   */
  segments?: DonutSegmentInput[]
  /** Sort custom segments largest-first (category breakdown charts). */
  sortSegments?: boolean
  /** Full ring or 180° semi-gauge. Defaults to full. */
  chartStyle?: DonutChartStyle
}>()

const SCORE_TOOLTIP =
  'Overall accessibility score uses the Siteimprove model: 90 points for WCAG checks (weighted by level A / AA / AAA) and 10 for best practices, with progress based on failed vs total occurrences per check and a logarithmic curve near 100%.'

const IMPACT_COLOR_TOKENS: Record<string, string> = {
  critical: 'var(--donut-segment-4)',
  serious: 'var(--donut-segment-4)',
  moderate: 'var(--donut-segment-2)',
  minor: 'var(--donut-segment-3)'
}

const hovered = ref(false)
const reduceMotion = ref(false)

onMounted(() => {
  if (!import.meta.client) return
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduceMotion.value = mq.matches
  const onChange = () => {
    reduceMotion.value = mq.matches
  }
  mq.addEventListener('change', onChange)
  onUnmounted(() => mq.removeEventListener('change', onChange))
})

const hoverInteractive = computed(() => props.severityHover || props.hoverZoom)

const scoreSegmentColor = computed(() => {
  if (props.severityHover && hovered.value) {
    return scoreRingColor(props.score)
  }
  return props.ringColor ?? 'var(--donut-segment-1)'
})

function onDonutEnter() {
  if (!hoverInteractive.value) return
  hovered.value = true
}

function onDonutLeave() {
  if (!hoverInteractive.value) return
  hovered.value = false
}

const isSiteTarget = computed(() => props.variant === 'site-target')
const chartStyle = computed((): DonutChartStyle => props.chartStyle ?? DEFAULT_DONUT_CHART_STYLE)
const isSemi = computed(() => chartStyle.value === 'semi')
const geometry = computed(() =>
  isSemi.value ? semiDonutRingGeometry() : donutRingGeometry()
)

const normalizedScore = computed(() => Math.max(0, Math.min(100, props.score)))

const scoreSegments = computed((): DonutSegmentInput[] => {
  if (props.segments?.length) {
    return props.segments.map((segment, index) => ({
      label: segment.label,
      value: segment.value,
      color: segment.color || DONUT_SEGMENT_TOKENS[index % DONUT_SEGMENT_TOKENS.length]!
    }))
  }
  const inputs = scoreDonutSegments(normalizedScore.value, {
    scoreLabel: props.label || (isSiteTarget.value ? 'Site score' : 'Overall score'),
    remainderLabel: 'Remaining'
  })
  return inputs.map((segment) => {
    if (segment.color === 'var(--donut-segment-1)') {
      return { ...segment, color: scoreSegmentColor.value }
    }
    return segment
  })
})

const laidOutScoreSegments = computed(() =>
  layoutDonutSegments(scoreSegments.value, {
    sortDescending: Boolean(props.segments?.length && props.sortSegments),
    geometry: geometry.value,
    chartStyle: chartStyle.value
  })
)

const normalizedPotential = computed(() => {
  const potential = props.potentialScore
  if (potential == null) return null
  return Math.max(0, Math.min(100, potential))
})

const showPotentialGain = computed(() => {
  if (!isSiteTarget.value || normalizedPotential.value == null) return false
  return normalizedPotential.value > normalizedScore.value + 0.05
})

const gainSegment = computed(() => {
  if (!showPotentialGain.value || normalizedPotential.value == null) return null
  const gain = normalizedPotential.value - normalizedScore.value
  if (gain <= 0) return null
  const inputs: DonutSegmentInput[] = [
    { label: 'Score', value: normalizedScore.value, color: 'transparent' },
    { label: 'Gain', value: gain, color: scoreSegmentColor.value },
    { label: 'Remaining', value: Math.max(0, 100 - normalizedPotential.value), color: 'transparent' }
  ]
  const laidOut = layoutDonutSegments(inputs, {
    sortDescending: false,
    geometry: geometry.value,
    chartStyle: chartStyle.value
  })
  return laidOut.find(segment => segment.label === 'Gain') ?? null
})

const impactSegments = computed((): DonutSegmentInput[] => {
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
      color: IMPACT_COLOR_TOKENS[key]!
    }))
})

const impactGeometry = computed(() => {
  const base = geometry.value
  const thickness = Math.max(4, base.outerRadius - base.innerRadius) * 0.38
  return donutRingGeometry({
    outerRadius: Math.min(49.5, base.outerRadius + thickness + 1.25),
    thickness,
    cornerRadius: Math.max(1.6, base.cornerRadius * 0.7),
    gapDeg: 4
  })
})

const laidOutImpactSegments = computed(() => {
  if (!impactSegments.value.length) return []
  return layoutDonutSegments(impactSegments.value, {
    sortDescending: true,
    geometry: impactGeometry.value,
    colorTokens: DONUT_SEGMENT_TOKENS
  })
})

const showImpactRing = computed(() =>
  !isSemi.value
  && !isSiteTarget.value
  && props.showOverallLabel
  && laidOutImpactSegments.value.length > 0
)

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'size-20'
  // Overview / default large charts match Nuxt Charts DonutChart width (~255px).
  return 'size-[255px]'
})
const isLarge = computed(() => props.size !== 'sm' || isSiteTarget.value)

const displayScore = computed(() => formatAccessibilityScore(props.score))
const displayPotentialScore = computed(() =>
  normalizedPotential.value == null
    ? null
    : formatAccessibilityScore(normalizedPotential.value)
)

const displayValue = computed(() => {
  if (showPotentialGain.value && displayPotentialScore.value) {
    return displayPotentialScore.value
  }
  return displayScore.value
})

const displayUnit = computed(() => props.unit ?? '%')

const displayCaption = computed(() => {
  if (props.caption) return props.caption
  if (showPotentialGain.value) return 'Could be'
  if (props.label) return props.label
  if (isSiteTarget.value) return 'Site score'
  if (props.showOverallLabel && isLarge.value) return 'Overall score'
  return ''
})

const deltaClass = computed(() => {
  if (!props.delta) return 'text-muted'
  if (props.delta.startsWith('+')) return 'text-success'
  if (props.delta.startsWith('-')) return 'text-error'
  return 'text-muted'
})

const ariaLabel = computed(() => {
  const parts = laidOutScoreSegments.value.map(
    segment => `${segment.label} ${Math.round(segment.fraction * 100)} percent`
  )
  const summary = parts.join(', ')
  if (props.label) return `${props.label} score ${displayScore.value}. ${summary}`
  if (isSiteTarget.value) {
    const deltaPart = props.delta ? `, change ${props.delta}` : ''
    return `Site score ${displayScore.value} percent${deltaPart}. ${summary}`
  }
  return `Overall score ${displayScore.value}. ${summary}`
})

const hiddenBreakdown = computed(() => {
  const rows = [...laidOutScoreSegments.value]
  if (showImpactRing.value) {
    rows.push(...laidOutImpactSegments.value)
  }
  return rows
})
</script>

<template>
  <div
    class="score-donut relative inline-flex flex-col items-center"
    :class="[
      sizeClass,
      {
        'score-donut--interactive': hoverInteractive,
        'score-donut--hovered': hoverInteractive && hovered,
        'score-donut--animate': !reduceMotion,
        'score-donut--semi': isSemi
      }
    ]"
    @mouseenter="onDonutEnter"
    @mouseleave="onDonutLeave"
  >
    <svg
      class="score-donut-svg size-full"
      :viewBox="isSemi ? '-8 18 116 72' : `0 0 ${DONUT_VIEWBOX} ${DONUT_VIEWBOX}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="ariaLabel"
    >
      <g class="score-donut-rings-group">
        <path
          v-for="(segment, index) in laidOutScoreSegments"
          :key="`score-${segment.label}-${index}`"
          class="score-donut-segment"
          :d="segment.path"
          :fill="segment.color"
        />
        <path
          v-if="gainSegment"
          class="score-donut-gain"
          :d="gainSegment.path"
          :fill="gainSegment.color"
          opacity="0.4"
        />
      </g>
      <g v-if="showImpactRing" class="score-donut-impact-group">
        <path
          v-for="(segment, index) in laidOutImpactSegments"
          :key="`impact-${segment.label}-${index}`"
          class="score-donut-segment"
          :d="segment.path"
          :fill="segment.color"
        />
      </g>
    </svg>

    <div
      class="score-donut-center absolute inset-0 flex flex-col items-center px-[12%] text-center pointer-events-none"
      :class="isSemi ? 'score-donut-center--semi' : 'justify-center'"
    >
      <div class="score-donut-value-row flex items-baseline justify-center gap-[0.12em] leading-none">
        <span class="score-donut-value font-bold tabular-nums tracking-tight">
          {{ displayValue }}
        </span>
        <span class="score-donut-unit font-semibold tabular-nums">
          {{ displayUnit }}
        </span>
        <span
          v-if="scoreUpdating && isSiteTarget && !showPotentialGain"
          class="score-donut-updating inline-flex items-center text-muted pointer-events-auto"
          role="status"
          aria-live="polite"
        >
          <UIcon name="i-lucide-loader-circle" class="size-[0.9em] animate-spin" />
        </span>
      </div>
      <span
        v-if="displayCaption"
        class="score-donut-caption mt-[0.35em] font-normal"
      >
        {{ displayCaption }}
      </span>
      <div
        v-if="delta && isSiteTarget && !showPotentialGain"
        class="score-donut-delta mt-[0.45em] flex items-center gap-1 font-medium pointer-events-auto"
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
      <UTooltip
        v-else-if="showOverallLabel && isLarge && !isSiteTarget && !props.caption"
        :text="SCORE_TOOLTIP"
        :popper="{ placement: 'bottom' }"
      >
        <button
          type="button"
          class="mt-1 text-muted hover:text-default transition-colors pointer-events-auto"
          aria-label="How overall score is calculated"
        >
          <UIcon name="i-lucide-info" class="size-3.5" />
        </button>
      </UTooltip>
    </div>

    <table class="sr-only">
      <caption>Donut chart values</caption>
      <thead>
        <tr>
          <th scope="col">Segment</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in hiddenBreakdown" :key="`a11y-${row.label}-${index}`">
          <td>{{ row.label }}</td>
          <td>{{ row.value }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.score-donut {
  container-type: inline-size;
  container-name: score-donut;
}

.score-donut--interactive {
  cursor: default;
}

.score-donut-segment {
  transition: fill 320ms cubic-bezier(0.22, 1, 0.36, 1), stroke 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.score-donut-gain {
  transition:
    fill 320ms cubic-bezier(0.22, 1, 0.36, 1),
    stroke 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.score-donut-rings-group {
  transform-box: view-box;
  transform-origin: 50% 50%;
  transition: transform 380ms cubic-bezier(0.34, 1.45, 0.64, 1);
}

.score-donut--hovered .score-donut-rings-group {
  transform: scale(1.04);
}

.score-donut-center {
  transform-box: border-box;
  transform-origin: center center;
  transition: transform 380ms cubic-bezier(0.34, 1.45, 0.64, 1);
}

/*
 * Semi label: inside the bowl, near the diameter. Vertically centred SVG
 * puts the diameter ~69% down; slightly less padding nudges text down.
 */
.score-donut-center--semi {
  justify-content: flex-end;
  padding-bottom: 28%;
  padding-inline: 18%;
}

.score-donut--hovered .score-donut-center {
  transform: scale(1.04);
}

.score-donut--semi.score-donut--hovered .score-donut-center {
  transform-origin: center bottom;
}

.score-donut-value {
  color: var(--donut-label);
  font-size: 15cqw;
  line-height: 1;
}

.score-donut-unit {
  color: var(--donut-label-muted);
  font-size: calc(15cqw * 0.35);
  line-height: 1;
}

.score-donut-caption {
  color: var(--donut-label-muted);
  font-size: calc(15cqw * 0.4);
  line-height: 1.2;
}

.score-donut-delta {
  font-size: calc(15cqw * 0.32);
}

.score-donut-updating {
  font-size: 15cqw;
}

.score-donut--semi .score-donut-value {
  font-size: 12.5cqw;
}

.score-donut--semi .score-donut-unit {
  font-size: calc(12.5cqw * 0.35);
}

.score-donut--semi .score-donut-caption {
  font-size: calc(12.5cqw * 0.4);
}

.score-donut--semi .score-donut-delta {
  font-size: calc(12.5cqw * 0.32);
}

.score-donut--semi .score-donut-updating {
  font-size: 12.5cqw;
}

.score-donut--semi .score-donut-rings-group {
  transform-origin: 50% 76%;
}

.score-donut--semi.score-donut--hovered .score-donut-rings-group {
  transform: scale(1.03);
}

@media (prefers-reduced-motion: no-preference) {
  .score-donut--animate .score-donut-rings-group {
    transform-origin: 50% 50%;
    animation: score-donut-sweep 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .score-donut--animate.score-donut--semi .score-donut-rings-group {
    animation-name: score-donut-semi-sweep;
  }
}

@keyframes score-donut-sweep {
  from {
    opacity: 0;
    transform: rotate(-24deg) scale(0.96);
  }
  to {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }
}

@keyframes score-donut-semi-sweep {
  from {
    opacity: 0;
    transform: rotate(-12deg) scale(0.96);
  }
  to {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }
}
</style>
