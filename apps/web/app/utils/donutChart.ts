/**
 * Annular-sector donut geometry (plain SVG).
 * Thick ring, soft corner fillets (not pill caps), even gaps, clockwise from ~11 o'clock.
 * Semi style uses a 180° gauge (left → top → right) with the same ring math.
 */

export const DONUT_VIEWBOX = 100
/**
 * Display size for overview / site-target score donuts.
 * Matches Nuxt Charts `DonutChart` sizing (~255px wide).
 */
export const SCORE_DONUT_SIZE_PX = 255
/** Outer radius in viewBox units. */
export const DONUT_OUTER_RADIUS = 48
/** Ring thickness ≈ 1/8 of chart diameter. Cutout ≈ 74% of outer R. */
export const DONUT_THICKNESS = DONUT_VIEWBOX / 8
/**
 * Angular gap between segments. ~6.5° ≈ 8–10px on size-40/52 Overview charts.
 */
export const DONUT_GAP_DEG = 6.5
/**
 * Corner fillet radius in viewBox units.
 * ~7px at size-52 (208px), soft rounding without full pill caps.
 */
export const DONUT_CORNER_RADIUS = 3.4
/**
 * Start angle in radians (0 = 3 o'clock, increasing clockwise in SVG y-down).
 * 11 o'clock = -120° from +x.
 */
export const DONUT_START_ANGLE = (-120 * Math.PI) / 180
/**
 * Semi-gauge start: 9 o'clock. Clockwise sweep through 12 o'clock ends at 3 o'clock.
 */
export const DONUT_SEMI_START_ANGLE = Math.PI
/** Semi-gauge usable arc (180°). */
export const DONUT_SEMI_SWEEP = Math.PI

export type DonutChartStyle = 'full' | 'semi'

export const DONUT_CHART_STYLES = ['full', 'semi'] as const
export const DEFAULT_DONUT_CHART_STYLE: DonutChartStyle = 'full'
export const DONUT_CHART_STYLE_STORAGE_KEY = 'sitenook-donut-chart-style'

export function isDonutChartStyle(value: unknown): value is DonutChartStyle {
  return value === 'full' || value === 'semi'
}

/** CSS custom-property tokens for the five-stop segment palette. */
export const DONUT_SEGMENT_TOKENS = [
  'var(--donut-segment-1)',
  'var(--donut-segment-2)',
  'var(--donut-segment-3)',
  'var(--donut-segment-4)',
  'var(--donut-segment-5)'
] as const

export type DonutSegmentInput = {
  label: string
  value: number
  /** Optional explicit colour token/value. Otherwise assigned from the palette. */
  color?: string
}

export type DonutSegmentLayout = {
  label: string
  value: number
  color: string
  /** Fraction of the total (0–1). */
  fraction: number
  startAngle: number
  endAngle: number
  path: string
}

export type DonutRingGeometry = {
  cx: number
  cy: number
  outerRadius: number
  innerRadius: number
  cornerRadius: number
  gapRad: number
}

export function donutRingGeometry(
  options: {
    outerRadius?: number
    thickness?: number
    cornerRadius?: number
    gapDeg?: number
    cx?: number
    cy?: number
  } = {}
): DonutRingGeometry {
  const outerRadius = options.outerRadius ?? DONUT_OUTER_RADIUS
  const thickness = options.thickness ?? DONUT_THICKNESS
  const cornerRadius = options.cornerRadius ?? DONUT_CORNER_RADIUS
  return {
    cx: options.cx ?? DONUT_VIEWBOX / 2,
    cy: options.cy ?? DONUT_VIEWBOX / 2,
    outerRadius,
    innerRadius: outerRadius - thickness,
    cornerRadius,
    gapRad: ((options.gapDeg ?? DONUT_GAP_DEG) * Math.PI) / 180
  }
}

/**
 * Semi-gauge geometry: larger ring with the diameter in the lower half so
 * the score label can sit inside the bowl, bottom-aligned to the end caps.
 */
export function semiDonutRingGeometry(): DonutRingGeometry {
  return donutRingGeometry({
    outerRadius: 54,
    cx: DONUT_VIEWBOX / 2,
    // Diameter ~76% down — tips near the lower third, arc fills most of the box.
    cy: 76
  })
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle)
  }
}

function clampCornerRadius(
  innerRadius: number,
  outerRadius: number,
  sweep: number,
  requested: number
): number {
  if (requested <= 0) return 0
  const thickness = outerRadius - innerRadius
  const byThickness = thickness / 2 - 0.05
  // Keep fillets from consuming the whole arc.
  const byOuterArc = (outerRadius * sweep) / 2 - 0.05
  const byInnerArc = (Math.max(innerRadius, 0.01) * sweep) / 2 - 0.05
  return Math.max(0, Math.min(requested, byThickness, byOuterArc, byInnerArc))
}

/**
 * Sharp annular sector (no corner fillets).
 * Angles: 0 = 3 o'clock, increasing clockwise (SVG y-down + sweep 1).
 */
export function annularSectorPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle
  if (sweep <= 0 || outerRadius <= innerRadius) return ''

  if (sweep >= Math.PI * 2 - 1e-6) {
    const mid = startAngle + Math.PI
    const outerStart = polar(cx, cy, outerRadius, startAngle)
    const outerMid = polar(cx, cy, outerRadius, mid)
    const innerStart = polar(cx, cy, innerRadius, startAngle)
    const innerMid = polar(cx, cy, innerRadius, mid)
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerMid.x} ${outerMid.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerStart.x} ${outerStart.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${innerMid.x} ${innerMid.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${innerStart.x} ${innerStart.y}`,
      'Z'
    ].join(' ')
  }

  const largeArc = sweep > Math.PI ? 1 : 0
  const outerStart = polar(cx, cy, outerRadius, startAngle)
  const outerEnd = polar(cx, cy, outerRadius, endAngle)
  const innerEnd = polar(cx, cy, innerRadius, endAngle)
  const innerStart = polar(cx, cy, innerRadius, startAngle)

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z'
  ].join(' ')
}

/**
 * Annular sector with circular fillets on all four corners.
 * Soft rounding (style-guide 6–8px class), not full pill linecaps.
 */
export function roundedAnnularSectorPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  cornerRadius: number
): string {
  const sweep = endAngle - startAngle
  if (sweep <= 0 || outerRadius <= innerRadius) return ''

  if (sweep >= Math.PI * 2 - 1e-6) {
    return annularSectorPath(cx, cy, innerRadius, outerRadius, startAngle, endAngle)
  }

  const cr = clampCornerRadius(innerRadius, outerRadius, sweep, cornerRadius)
  if (cr < 0.35) {
    return annularSectorPath(cx, cy, innerRadius, outerRadius, startAngle, endAngle)
  }

  const outerInset = cr / outerRadius
  const innerInset = cr / Math.max(innerRadius, 0.01)
  const outerStart = startAngle + outerInset
  const outerEnd = endAngle - outerInset
  const innerStart = startAngle + innerInset
  const innerEnd = endAngle - innerInset
  const outerSweep = outerEnd - outerStart
  const innerSweep = innerEnd - innerStart
  if (outerSweep <= 1e-4 || innerSweep <= 1e-4) {
    return annularSectorPath(cx, cy, innerRadius, outerRadius, startAngle, endAngle)
  }

  const largeOuter = outerSweep > Math.PI ? 1 : 0
  const largeInner = innerSweep > Math.PI ? 1 : 0

  // Walk clockwise: start-outer fillet → outer arc → end-outer fillet →
  // end radial → end-inner fillet → inner arc (ccw) → start-inner fillet → close.
  const pOuterArc0 = polar(cx, cy, outerRadius, outerStart)
  const pOuterArc1 = polar(cx, cy, outerRadius, outerEnd)
  const pOuterRadialEnd = polar(cx, cy, outerRadius - cr, endAngle)
  const pInnerRadialEnd = polar(cx, cy, innerRadius + cr, endAngle)
  const pInnerArc1 = polar(cx, cy, innerRadius, innerEnd)
  const pInnerArc0 = polar(cx, cy, innerRadius, innerStart)
  const pInnerRadialStart = polar(cx, cy, innerRadius + cr, startAngle)
  const pOuterRadialStart = polar(cx, cy, outerRadius - cr, startAngle)

  return [
    `M ${pOuterRadialStart.x} ${pOuterRadialStart.y}`,
    // Start-outer fillet (convex, clockwise into the outer arc)
    `A ${cr} ${cr} 0 0 1 ${pOuterArc0.x} ${pOuterArc0.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeOuter} 1 ${pOuterArc1.x} ${pOuterArc1.y}`,
    // End-outer fillet
    `A ${cr} ${cr} 0 0 1 ${pOuterRadialEnd.x} ${pOuterRadialEnd.y}`,
    `L ${pInnerRadialEnd.x} ${pInnerRadialEnd.y}`,
    // End-inner fillet
    `A ${cr} ${cr} 0 0 1 ${pInnerArc1.x} ${pInnerArc1.y}`,
    // Inner arc back (counter-clockwise = sweep 0)
    `A ${innerRadius} ${innerRadius} 0 ${largeInner} 0 ${pInnerArc0.x} ${pInnerArc0.y}`,
    // Start-inner fillet
    `A ${cr} ${cr} 0 0 1 ${pInnerRadialStart.x} ${pInnerRadialStart.y}`,
    'Z'
  ].join(' ')
}

/**
 * Start angle + usable sweep for a chart style.
 * Full: clockwise from ~11 o'clock over 360°.
 * Semi: left → top → right gauge over 180°.
 */
export function donutArcOptions(style: DonutChartStyle = DEFAULT_DONUT_CHART_STYLE): {
  startAngle: number
  arcSweep: number
} {
  if (style === 'semi') {
    return {
      startAngle: DONUT_SEMI_START_ANGLE,
      arcSweep: DONUT_SEMI_SWEEP
    }
  }
  return {
    startAngle: DONUT_START_ANGLE,
    arcSweep: Math.PI * 2
  }
}

/**
 * Layout segments clockwise along the chosen arc.
 * When `sortDescending` is true (categorical charts), largest value is first.
 * Score charts pass `sortDescending: false` and keep the score portion first.
 */
export function layoutDonutSegments(
  segments: DonutSegmentInput[],
  options: {
    sortDescending?: boolean
    startAngle?: number
    /** Total arc length in radians (default full circle). */
    arcSweep?: number
    chartStyle?: DonutChartStyle
    geometry?: DonutRingGeometry
    colorTokens?: readonly string[]
  } = {}
): DonutSegmentLayout[] {
  const geometry = options.geometry ?? donutRingGeometry()
  const styleDefaults = donutArcOptions(options.chartStyle ?? DEFAULT_DONUT_CHART_STYLE)
  const startAngle = options.startAngle ?? styleDefaults.startAngle
  const arcSweep = options.arcSweep ?? styleDefaults.arcSweep
  const tokens = options.colorTokens ?? DONUT_SEGMENT_TOKENS
  const sortDescending = options.sortDescending ?? true

  const cleaned = segments
    .map(segment => ({
      label: segment.label,
      value: Math.max(0, Number(segment.value) || 0),
      color: segment.color
    }))
    .filter(segment => segment.value > 0)

  if (!cleaned.length) return []

  const ordered = sortDescending
    ? [...cleaned].sort((a, b) => b.value - a.value)
    : cleaned

  const total = ordered.reduce((sum, segment) => sum + segment.value, 0)
  if (total <= 0) return []

  // Closed rings reserve a gap after every segment (including last → first).
  // Open arcs (semi) only need gaps *between* segments so both end caps sit
  // on the same horizontal (startAngle and startAngle + arcSweep).
  const isOpenArc = arcSweep < Math.PI * 2 - 1e-6
  const gapCount = ordered.length > 1
    ? (isOpenArc ? ordered.length - 1 : ordered.length)
    : 0
  const gapTotal = geometry.gapRad * gapCount
  const usable = Math.max(0, arcSweep - gapTotal)
  let cursor = startAngle

  return ordered.map((segment, index) => {
    const fraction = segment.value / total
    const sweep = usable * fraction
    const segStart = cursor
    const segEnd = cursor + sweep
    const addGapAfter = ordered.length > 1 && (isOpenArc
      ? index < ordered.length - 1
      : true)
    cursor = segEnd + (addGapAfter ? geometry.gapRad : 0)

    const color = segment.color ?? tokens[index % tokens.length]!
    const path = roundedAnnularSectorPath(
      geometry.cx,
      geometry.cy,
      geometry.innerRadius,
      geometry.outerRadius,
      segStart,
      segEnd,
      geometry.cornerRadius
    )

    return {
      label: segment.label,
      value: segment.value,
      color,
      fraction,
      startAngle: segStart,
      endAngle: segEnd,
      path
    }
  })
}

/** Score + remainder segments for Overview progress donuts. Score stays first and uses primary. */
export function scoreDonutSegments(
  score: number,
  options: { scoreLabel?: string, remainderLabel?: string } = {}
): DonutSegmentInput[] {
  const normalized = Math.max(0, Math.min(100, score))
  const remainder = Math.max(0, 100 - normalized)
  const segments: DonutSegmentInput[] = []
  if (normalized > 0) {
    segments.push({
      label: options.scoreLabel ?? 'Score',
      value: normalized,
      color: 'var(--donut-segment-1)'
    })
  }
  if (remainder > 0) {
    segments.push({
      label: options.remainderLabel ?? 'Remaining',
      value: remainder,
      color: 'var(--score-donut-track)'
    })
  }
  if (!segments.length) {
    segments.push({
      label: options.remainderLabel ?? 'Remaining',
      value: 100,
      color: 'var(--score-donut-track)'
    })
  }
  return segments
}
