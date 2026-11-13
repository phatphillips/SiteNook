<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/sitenook'
import {
  DEFAULT_DONUT_CHART_STYLE,
  DONUT_SEGMENT_TOKENS,
  DONUT_VIEWBOX,
  SCORE_DONUT_SIZE_PX,
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
  /**
   * Per-segment translucent halo on hover/focus/touch.
   * Defaults on; set false to disable.
   */
  segmentHalo?: boolean
  /**
   * Keyboard-focusable segments (same halo as hover). Defaults on when
   * custom `segments` are provided so overview buttons stay nesting-safe.
   */
  segmentFocusable?: boolean
}>()

const SCORE_TOOLTIP =
  'Overall accessibility score uses the Siteimprove model: 90 points for WCAG checks (weighted by level A / AA / AAA) and 10 for best practices, with progress based on failed vs total occurrences per check and a logarithmic curve near 100%.'

const IMPACT_COLOR_TOKENS: Record<string, string> = {
  critical: 'var(--donut-segment-4)',
  serious: 'var(--donut-segment-4)',
  moderate: 'var(--donut-segment-2)',
  minor: 'var(--donut-segment-3)'
}

const rootEl = ref<HTMLElement | null>(null)
const hovered = ref(false)
const reduceMotion = ref(false)
/** Pointer hover over a solid segment. */
const hoveredSegmentIndex = ref<number | null>(null)
/** Keyboard focus on a solid segment. */
const focusedSegmentIndex = ref<number | null>(null)
/** Touch selection; cleared when tapping outside. */
const touchSegmentIndex = ref<number | null>(null)

onMounted(() => {
  if (!import.meta.client) return
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduceMotion.value = mq.matches
  const onChange = () => {
    reduceMotion.value = mq.matches
  }
  mq.addEventListener('change', onChange)

  const onDocPointerDown = (event: PointerEvent) => {
    if (touchSegmentIndex.value == null) return
    const target = event.target as Node | null
    if (target && rootEl.value?.contains(target)) return
    touchSegmentIndex.value = null
  }
  document.addEventListener('pointerdown', onDocPointerDown)

  onUnmounted(() => {
    mq.removeEventListener('change', onChange)
    document.removeEventListener('pointerdown', onDocPointerDown)
  })
})

const hoverInteractive = computed(() => props.severityHover || props.hoverZoom)
const segmentHaloEnabled = computed(() => props.segmentHalo !== false)
const segmentFocusEnabled = computed(
  () => props.segmentFocusable ?? Boolean(props.segments?.length)
)

const activeSegmentIndex = computed(() => {
  if (!segmentHaloEnabled.value) return null
  return focusedSegmentIndex.value
    ?? hoveredSegmentIndex.value
    ?? touchSegmentIndex.value
})

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

function onSegmentEnter(index: number) {
  if (!segmentHaloEnabled.value) return
  hoveredSegmentIndex.value = index
}

function onSegmentLeave() {
  hoveredSegmentIndex.value = null
}

function onSegmentFocus(index: number) {
  if (!segmentHaloEnabled.value || !segmentFocusEnabled.value) return
  focusedSegmentIndex.value = index
}

function onSegmentBlur() {
  nextTick(() => {
    const active = document.activeElement
    if (!(active instanceof Element) || !active.classList.contains('score-donut-segment')) {
      focusedSegmentIndex.value = null
    }
  })
}

function onSegmentPointerDown(index: number, event: PointerEvent) {
  if (!segmentHaloEnabled.value) return
  if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
  touchSegmentIndex.value = index
}

function formatSegmentCentreValue(value: number): string {
  if (props.unit === '' || props.unit == null || props.unit === '%') {
    const rounded = Math.round(value * 10) / 10
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  }
  return String(Math.round(value))
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
  // Stay inside the square viewBox (no halo on the impact ring).
  const maxOuter = DONUT_VIEWBOX / 2 - 0.5
  const gap = 1.25
  const thickness = Math.min(
    Math.max(2.5, (base.outerRadius - base.innerRadius) * 0.35),
    Math.max(0, maxOuter - base.outerRadius - gap)
  )
  return donutRingGeometry({
    outerRadius: Math.min(maxOuter, base.outerRadius + gap + thickness),
    thickness,
    cornerRadius: Math.max(1.2, base.cornerRadius * 0.65),
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
  if (props.size === 'sm') return 'score-donut--sm'
  // Overview / default large charts match Nuxt Charts DonutChart width (~255px).
  return 'score-donut--lg'
})
const isLarge = computed(() => props.size !== 'sm' || isSiteTarget.value)

const rootStyle = computed(() => ({
  // Soft cap only — width is always 100% of the parent so the chart cannot
  // overflow a narrower card. Parents should set the available width.
  '--score-donut-size': props.size === 'sm' ? '5rem' : `${SCORE_DONUT_SIZE_PX}px`
}))

const displayScore = computed(() => formatAccessibilityScore(props.score))
const displayPotentialScore = computed(() =>
  normalizedPotential.value == null
    ? null
    : formatAccessibilityScore(normalizedPotential.value)
)

const activeSegment = computed(() => {
  const index = activeSegmentIndex.value
  if (index == null) return null
  return laidOutScoreSegments.value[index] ?? null
})

const displayValue = computed(() => {
  if (activeSegment.value) {
    return formatSegmentCentreValue(activeSegment.value.value)
  }
  if (showPotentialGain.value && displayPotentialScore.value) {
    return displayPotentialScore.value
  }
  return displayScore.value
})

const baseUnit = computed(() => props.unit ?? '%')

const displayUnit = computed(() => baseUnit.value)

function segmentAriaLabel(segment: { label: string, value: number }): string {
  const value = formatSegmentCentreValue(segment.value)
  const unit = baseUnit.value
  if (!unit) return `${segment.label}: ${value}`
  if (unit === '%') return `${segment.label}: ${value}%`
  return `${segment.label}: ${value} ${unit}`
}

const displayCaption = computed(() => {
  if (activeSegment.value) return activeSegment.value.label
  if (props.caption) return props.caption
  if (showPotentialGain.value) return 'Could be'
  if (props.label) return props.label
  if (isSiteTarget.value) return 'Site score'
  if (props.showOverallLabel && isLarge.value) return 'Overall score'
  return ''
})

const hasActiveSegment = computed(() => activeSegmentIndex.value != null)

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
    ref="rootEl"
    class="score-donut relative inline-flex flex-col items-center"
    :class="[
      sizeClass,
      {
        'score-donut--interactive': hoverInteractive,
        'score-donut--hovered': hoverInteractive && hovered,
        'score-donut--animate': !reduceMotion,
        'score-donut--semi': isSemi,
        'score-donut--segment-active': hasActiveSegment,
        'score-donut--halo': segmentHaloEnabled
      }
    ]"
    :style="rootStyle"
    @mouseenter="onDonutEnter"
    @mouseleave="onDonutLeave"
  >
    <svg
      class="score-donut-svg"
      :viewBox="`0 0 ${DONUT_VIEWBOX} ${DONUT_VIEWBOX}`"
      preserveAspectRatio="xMidYMid meet"
      :role="segmentHaloEnabled && segmentFocusEnabled ? 'group' : 'img'"
      :aria-label="ariaLabel"
    >
      <g class="score-donut-rings-group">
        <!-- Halos under solid segments so fill colour stays untinted. -->
        <g v-if="segmentHaloEnabled" class="score-donut-halo-group" aria-hidden="true">
          <path
            v-for="(segment, index) in laidOutScoreSegments"
            :key="`halo-${segment.label}-${index}`"
            class="score-donut-halo"
            :class="{ 'score-donut-halo--active': activeSegmentIndex === index }"
            :d="segment.haloPath"
            :fill="segment.color"
            pointer-events="none"
          />
        </g>
        <path
          v-for="(segment, index) in laidOutScoreSegments"
          :key="`score-${segment.label}-${index}`"
          class="score-donut-segment"
          :class="{
            'score-donut-segment--dimmed': hasActiveSegment && activeSegmentIndex !== index,
            'score-donut-segment--active': activeSegmentIndex === index
          }"
          :d="segment.path"
          :fill="segment.color"
          :tabindex="segmentHaloEnabled && segmentFocusEnabled ? 0 : undefined"
          :role="segmentHaloEnabled && segmentFocusEnabled ? 'button' : undefined"
          :aria-label="segmentHaloEnabled && segmentFocusEnabled
            ? segmentAriaLabel(segment)
            : undefined"
          @mouseenter="onSegmentEnter(index)"
          @mouseleave="onSegmentLeave"
          @focus="onSegmentFocus(index)"
          @blur="onSegmentBlur"
          @pointerdown="onSegmentPointerDown(index, $event)"
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
  box-sizing: border-box;
  container-type: inline-size;
  container-name: score-donut;
  /*
   * Fill the parent. Soft-cap with --score-donut-size so a wide card does not
   * stretch the chart past the design size. Never wider than the parent.
   */
  width: 100%;
  max-width: min(100%, var(--score-donut-size, 255px));
  height: auto;
  aspect-ratio: 1;
  overflow: visible;
}

.score-donut--sm {
  --score-donut-size: 5rem;
}

.score-donut--lg {
  --score-donut-size: 255px;
}

.score-donut-svg {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  /* SVG default overflow is hidden in some engines — keep halo/ring visible. */
  overflow: visible !important;
}

.score-donut--interactive {
  cursor: default;
}

.score-donut--halo .score-donut-segment {
  cursor: pointer;
  outline: none;
}

.score-donut-segment {
  transition:
    fill 320ms cubic-bezier(0.22, 1, 0.36, 1),
    stroke 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 150ms ease;
}

.score-donut-segment--dimmed {
  opacity: 0.75;
}

.score-donut-halo {
  opacity: 0;
  transform: scale(0.97);
  transform-box: view-box;
  transform-origin: 50% 50%;
  pointer-events: none;
  /* Same token as the segment; alpha via opacity (follows theme / primary). */
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.score-donut-halo--active {
  opacity: 0.3;
  transform: scale(1);
}

.score-donut--semi .score-donut-halo {
  transform-origin: 50% 58%;
}

.score-donut--semi .score-donut-halo--active {
  transform: scale(1);
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
 * Semi label: inside the bowl, near the diameter (~58% down in the square
 * viewBox). Pad from the bottom so the value sits just above the end caps.
 */
.score-donut-center--semi {
  justify-content: flex-end;
  padding-bottom: 36%;
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
  transform-origin: 50% 58%;
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

@media (prefers-reduced-motion: reduce) {
  .score-donut-halo,
  .score-donut-segment {
    transition: none;
  }

  .score-donut-halo {
    transform: none;
  }

  .score-donut-halo--active {
    transform: none;
  }
}
</style>
