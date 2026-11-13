/**
 * Annular-sector donut geometry (plain SVG).
 * Soft corner fillets (not pill caps), even gaps, clockwise from ~11 o'clock.
 * Semi style uses a 180° gauge (left → top → right) with the same ring math.
 *
 * All radii derive from a square viewBox so the solid ring and its hover halo
 * stay inside 0…S at every display size.
 */

/** Square viewBox side length (S). */
export const DONUT_VIEWBOX = 100
/**
 * Display size for overview / site-target score donuts.
 * Matches Nuxt Charts `DonutChart` sizing (~255px wide).
 */
export const SCORE_DONUT_SIZE_PX = 255

/**
 * Halo extent beyond the solid outer edge (viewBox units).
 * ~3.5 ≈ 9px outward at 255px display; ~1.6 ≈ 4px inward.
 */
export const DONUT_HALO_OUTER_EXPAND = 3.5
export const DONUT_HALO_INNER_EXPAND = 1.6

/**
 * Extra empty margin outside the halo so the chart never sits flush against
 * the SVG edge (or a parent border) at any display size.
 * Larger value = more obvious breathing room around the ring + halo.
 */
export const DONUT_EDGE_MARGIN = 4

/**
 * Inset from each viewBox edge so the full halo + margin stay inside.
 * Paths are fills (no stroke), so no half-stroke inset is required.
 * outerRadius = S/2 − padding.
 */
export const DONUT_VIEWBOX_PADDING = DONUT_HALO_OUTER_EXPAND + DONUT_EDGE_MARGIN

/** Outer radius: S/2 − padding. Halo + margin stay inside the viewBox. */
export const DONUT_OUTER_RADIUS = DONUT_VIEWBOX / 2 - DONUT_VIEWBOX_PADDING

/**
 * Cutout ratio. inner ≈ 0.75 × outer → ring thickness ≈ 12.5% of outer diameter
 * (≈ 12% of the chart diameter the user measures).
 */
export const DONUT_INNER_RATIO = 0.75

/** Ring thickness in viewBox units (derived; do not add stroke on top). */
export const DONUT_THICKNESS = DONUT_OUTER_RADIUS * (1 - DONUT_INNER_RATIO)

/**
 * Angular gap between segments. ~6.5° ≈ 8–10px on size-40/52 Overview charts.
 */
export const DONUT_GAP_DEG = 6.5

/**
 * Corner fillet radius in viewBox units (~28% of thickness).
 * Soft rounding without full pill caps.
 */
export const DONUT_CORNER_RADIUS = Math.round(DONUT_THICKNESS * 0.28 * 10) / 10

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
  /** Larger annular sector for hover/focus halo (same angles + gaps). */
  haloPath: string
}

export type DonutRingGeometry = {
  cx: number
  cy: number
  outerRadius: number
  innerRadius: number
  cornerRadius: number
  gapRad: number
}

/** Expanded ring geometry for a translucent hover/focus halo. */
export function donutHaloGeometry(
  base: DonutRingGeometry,
  options: { outerExpand?: number, innerExpand?: number } = {}
): DonutRingGeometry {
  const outerExpand = options.outerExpand ?? DONUT_HALO_OUTER_EXPAND
  const innerExpand = options.innerExpand ?? DONUT_HALO_INNER_EXPAND
  return {
    ...base,
    outerRadius: base.outerRadius + outerExpand,
    innerRadius: Math.max(0, base.innerRadius - innerExpand)
  }
}

export function donutRingGeometry(
  options: {
    outerRadius?: number
    /** Override inner radius. Ignored when `thickness` is set. */
    innerRadius?: number
    /** Override thickness (outer − inner). Defaults to ~12% of outer diameter. */
    thickness?: number
    cornerRadius?: number
    gapDeg?: number
    cx?: number
    cy?: number
  } = {}
): DonutRingGeometry {
  const outerRadius = options.outerRadius ?? DONUT_OUTER_RADIUS
  const innerRadius = options.thickness != null
    ? outerRadius - options.thickness
    : (options.innerRadius ?? outerRadius * DONUT_INNER_RATIO)
  const cornerRadius = options.cornerRadius ?? DONUT_CORNER_RADIUS
  return {
    cx: options.cx ?? DONUT_VIEWBOX / 2,
    cy: options.cy ?? DONUT_VIEWBOX / 2,
    outerRadius,
    innerRadius: Math.max(0, Math.min(innerRadius, outerRadius)),
    cornerRadius,
    gapRad: ((options.gapDeg ?? DONUT_GAP_DEG) * Math.PI) / 180
  }
}

/**
 * Semi-gauge geometry: same ring metrics as full, diameter slightly below
 * centre so the HTML label sits in the bowl. Halo still fits in the square
 * viewBox (top: cy − outer − halo ≥ 0).
 */
export function semiDonutRingGeometry(): DonutRingGeometry {
  const outerRadius = DONUT_OUTER_RADIUS
  const halo = DONUT_HALO_OUTER_EXPAND
  const minCy = outerRadius + halo
  const maxCy = DONUT_VIEWBOX - halo
  const preferredCy = DONUT_VIEWBOX * 0.58
  const cy = Math.min(maxCy, Math.max(minCy, preferredCy))
  return donutRingGeometry({
    outerRadius,
    cx: DONUT_VIEWBOX / 2,
    cy
  })
}

/** True when a ring (including optional halo) stays inside the square viewBox. */
export function donutGeometryFitsViewBox(
  geometry: DonutRingGeometry,
  options: { includeHalo?: boolean } = {}
): boolean {
  const expand = options.includeHalo === false ? 0 : DONUT_HALO_OUTER_EXPAND
  const maxR = geometry.outerRadius + expand
  const left = geometry.cx - maxR
  const right = geometry.cx + maxR
  const top = geometry.cy - maxR
  const bottom = geometry.cy + maxR
  return left >= -1e-6
    && top >= -1e-6
    && right <= DONUT_VIEWBOX + 1e-6
    && bottom <= DONUT_VIEWBOX + 1e-6
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
    const halo = donutHaloGeometry(geometry)
    const haloPath = roundedAnnularSectorPath(
      halo.cx,
      halo.cy,
      halo.innerRadius,
      halo.outerRadius,
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
      path,
      haloPath
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
