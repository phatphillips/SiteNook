import {
  primaryColorRgbTriplet,
  resolvePrimaryPaintColor,
  cssColorToRgbTriplet
} from '~/utils/primaryColor'

/** Chart accent. Data series only (not buttons or primary UI chrome). */

/** Overview donut segment tokens (`--donut-segment-*` in main.css). */
export const DONUT_SEGMENT_CSS_VARS = [
  'var(--donut-segment-1)',
  'var(--donut-segment-2)',
  'var(--donut-segment-3)',
  'var(--donut-segment-4)',
  'var(--donut-segment-5)'
] as const

/** Fallback when CSS primary tokens are unavailable (SSR / first paint). */
export const CHART_LINE_COLOR = '#2b7fff'
export const CHART_LINE_RGB = '43, 127, 255'

/** @deprecated Alias of CHART_LINE_COLOR; prefer chartPrimaryColor(). */
export const CHART_PURPLE_COLOR = CHART_LINE_COLOR
/** @deprecated Alias of CHART_LINE_RGB; prefer chartPrimaryRgb(). */
export const CHART_PURPLE_RGB = CHART_LINE_RGB

export type ChartThemeVariant = 'light' | 'dark'

export function resolveChartThemeVariant(colorMode: string): ChartThemeVariant {
  if (colorMode === 'dark') return 'dark'
  return 'light'
}

/**
 * Canvas-safe primary paint for charts.
 * Prefer the synced `--color-chart-line` / named Tailwind scale (same as score chips).
 */
export function chartPrimaryColor(colorName?: string | null): string {
  if (import.meta.client) {
    const paint = resolvePrimaryPaintColor(colorName)
    if (paint) {
      const rgb = cssColorToRgbTriplet(paint)
      if (rgb) return `rgb(${rgb})`
      return paint
    }
  }
  return CHART_LINE_COLOR
}

export function chartPrimaryRgb(colorName?: string | null): string {
  if (import.meta.client) {
    const rgb = primaryColorRgbTriplet(colorName)
    if (rgb) return rgb
  }
  return CHART_LINE_RGB
}

export function chartLineColor(
  _variant?: ChartThemeVariant,
  colorName?: string | null
): string {
  return chartPrimaryColor(colorName)
}

export function chartLineRgb(
  _variant?: ChartThemeVariant,
  colorName?: string | null
): string {
  return chartPrimaryRgb(colorName)
}

/** Theme-aware neutral series: white in dark mode, near-black in light. */
export function chartNeutralLineColor(variant: ChartThemeVariant): string {
  if (variant === 'dark') return '#ffffff'
  return '#111827'
}

export function chartNeutralLineRgb(variant: ChartThemeVariant): string {
  if (variant === 'dark') return '255, 255, 255'
  return '17, 24, 39'
}

/**
 * Theme-aware score chip / site issue bar colors via CSS variables
 * (`--score-chip-*` in main.css + theme files). Fallbacks match light theme.
 */
export const A11Y_BAR_FILL = 'var(--score-chip-fill, #3f3f46)'
export const A11Y_BAR_FILL_HOVER = 'var(--score-chip-fill-hover, #2b7fff)'
export const A11Y_BAR_TRACK = 'var(--score-chip-track, #e4e4e7)'
/** Label on the unfilled track (visible when progress is low). */
export const A11Y_BAR_TEXT = 'var(--score-chip-text, #18181b)'
/** Label clipped to the filled region. */
export const A11Y_BAR_TEXT_ON_FILL = 'var(--score-chip-text-on-fill, #ffffff)'
/** Label on primary hover fill. */
export const A11Y_BAR_TEXT_ON_HOVER = 'var(--score-chip-text-on-hover, #000000)'

/** @deprecated Use A11Y_BAR_FILL */
export const A11Y_PURPLE_GRAY_FILL = A11Y_BAR_FILL
/** @deprecated Use A11Y_BAR_FILL_HOVER */
export const A11Y_PURPLE_GRAY_FILL_HOVER = A11Y_BAR_FILL_HOVER
/** @deprecated Use A11Y_BAR_TRACK */
export const A11Y_PURPLE_GRAY_TRACK = A11Y_BAR_TRACK

export function chartPurpleLineColor(
  _variant?: ChartThemeVariant,
  colorName?: string | null
): string {
  return chartPrimaryColor(colorName)
}

export function chartPurpleLineRgb(
  _variant?: ChartThemeVariant,
  colorName?: string | null
): string {
  return chartPrimaryRgb(colorName)
}

/**
 * Distinct colors for multi-series score trend overlays (Overall + WCAG levels).
 * Overall follows the active primary; other series stay fixed for legend stability.
 */
export function scoreTrendSeriesColors() {
  return {
    overall: chartPrimaryColor(),
    a: '#0ea5e9',
    aa: '#10b981',
    aaa: '#f59e0b',
    bestPractices: '#ec4899'
  } as const
}

/** @deprecated Prefer scoreTrendSeriesColors() so overall tracks primary. */
export const SCORE_TREND_SERIES_COLORS = {
  get overall() {
    return chartPrimaryColor()
  },
  a: '#0ea5e9',
  aa: '#10b981',
  aaa: '#f59e0b',
  bestPractices: '#ec4899'
} as const

export type ChartSeriesTone = 'accent' | 'neutral' | 'purple'

export function chartSeriesColor(
  variant: ChartThemeVariant,
  tone: ChartSeriesTone = 'accent',
  colorName?: string | null
): string {
  if (tone === 'neutral') return chartNeutralLineColor(variant)
  if (tone === 'purple') return chartPurpleLineColor(variant, colorName)
  return chartLineColor(variant, colorName)
}

export function chartSeriesRgb(
  variant: ChartThemeVariant,
  tone: ChartSeriesTone = 'accent',
  colorName?: string | null
): string {
  if (tone === 'neutral') return chartNeutralLineRgb(variant)
  if (tone === 'purple') return chartPurpleLineRgb(variant, colorName)
  return chartLineRgb(variant, colorName)
}

export function chartAreaFill(
  ctx: CanvasRenderingContext2D,
  chartArea: { top: number, bottom: number },
  peakOpacity = 0.5,
  lineRgb = chartPrimaryRgb()
): CanvasGradient | string {
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
  gradient.addColorStop(0, `rgba(${lineRgb}, ${peakOpacity})`)
  gradient.addColorStop(0.75, `rgba(${lineRgb}, 0)`)
  gradient.addColorStop(1, `rgba(${lineRgb}, 0)`)
  return gradient
}

export type ChartTooltipPalette = {
  backgroundColor: string
  titleColor: string
  bodyColor: string
  borderColor: string
  valueColor: string
}

export function chartTooltipPalette(variant: ChartThemeVariant): ChartTooltipPalette {
  if (variant === 'dark') {
    return {
      backgroundColor: '#1a1a1a',
      titleColor: '#ffffff',
      bodyColor: 'rgba(255, 255, 255, 0.65)',
      borderColor: '#2d2d2d',
      valueColor: '#ffffff'
    }
  }

  return {
    backgroundColor: '#ffffff',
    titleColor: '#000000',
    bodyColor: '#374151',
    borderColor: '#e5e7eb',
    valueColor: '#000000'
  }
}

/** Solid fill behind Chart.js PNG exports (canvas is otherwise transparent). */
export function chartExportBackgroundColor(variant: ChartThemeVariant): string {
  if (variant === 'dark') return 'rgb(19, 20, 24)'
  return '#ffffff'
}

/** Flat leading segment before first real data point (overview MetricTrendCard style). */
export function chartPlaceholderLineColor(variant: ChartThemeVariant): string {
  if (variant === 'dark') return 'rgba(148, 163, 184, 0.5)'
  return 'rgba(107, 114, 128, 0.5)'
}

export function chartAxisTickColor(variant: ChartThemeVariant): string {
  if (variant === 'dark') return 'rgba(255,255,255,0.35)'
  return 'rgba(0,0,0,0.35)'
}

export function chartPointBorderColor(variant: ChartThemeVariant): string {
  if (variant === 'dark') return '#1a1a1a'
  return '#ffffff'
}

/** Subtle plot-area grid lines for timeline charts. */
export function chartGridColor(variant: ChartThemeVariant): string {
  if (variant === 'dark') return 'rgba(255, 255, 255, 0.055)'
  return 'rgba(0, 0, 0, 0.055)'
}

type TooltipCallbackCtx = {
  parsed: { y: number | null }
  dataset: { label?: string }
}

export function buildChartTooltipOptions(opts: {
  variant: ChartThemeVariant
  seriesLabel: string
  formatValue?: (value: number) => string
  enabled?: boolean
  /** Override series swatch color (defaults to active primary). */
  seriesColor?: string
  /**
   * Tooltip vertical alignment relative to the caret.
   * Chart.js: `'bottom'` places the tooltip above the point.
   */
  yAlign?: 'top' | 'center' | 'bottom'
}) {
  const palette = chartTooltipPalette(opts.variant)
  const formatValue = opts.formatValue ?? ((v: number) => String(v))
  const lineColor = opts.seriesColor ?? chartLineColor(opts.variant)

  return {
    enabled: opts.enabled ?? true,
    backgroundColor: palette.backgroundColor,
    titleColor: palette.titleColor,
    bodyColor: palette.bodyColor,
    borderColor: palette.borderColor,
    borderWidth: 1,
    cornerRadius: 8,
    padding: { top: 12, right: 12, bottom: 10, left: 12 },
    titleMarginBottom: 8,
    titleFont: { weight: 'bold' as const, size: 14 },
    bodyFont: { size: 14 },
    displayColors: true,
    boxWidth: 8,
    boxHeight: 8,
    boxPadding: 6,
    usePointStyle: true,
    ...(opts.yAlign ? { yAlign: opts.yAlign } : {}),
    callbacks: {
      label(ctx: TooltipCallbackCtx) {
        const y = ctx.parsed.y
        if (y == null) return ''
        const label = ctx.dataset.label ?? opts.seriesLabel
        return ` ${label}   ${formatValue(y)}`
      },
      labelTextColor() {
        return palette.bodyColor
      },
      labelColor() {
        return {
          borderColor: lineColor,
          backgroundColor: lineColor
        }
      }
    }
  }
}
