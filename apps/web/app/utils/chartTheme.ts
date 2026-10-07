/** Chart accent. Data series only (not buttons or primary UI chrome). */

export const CHART_LINE_COLOR = '#00c16a'

export const CHART_LINE_RGB = '0, 193, 106'

export const SOLARIZED_CHART_LINE_COLOR = '#859900'

export const SOLARIZED_CHART_LINE_RGB = '133, 153, 0'



export type ChartThemeVariant = 'light' | 'dark' | 'solarized-light'



export function resolveChartThemeVariant(colorMode: string): ChartThemeVariant {

  if (colorMode === 'dark') return 'dark'

  if (colorMode === 'solarized-light') return 'solarized-light'

  return 'light'

}



export function chartLineColor(variant: ChartThemeVariant): string {

  return variant === 'solarized-light' ? SOLARIZED_CHART_LINE_COLOR : CHART_LINE_COLOR

}



export function chartLineRgb(variant: ChartThemeVariant): string {

  return variant === 'solarized-light' ? SOLARIZED_CHART_LINE_RGB : CHART_LINE_RGB

}



/** Theme-aware neutral series: white in dark mode, near-black in light. */
export function chartNeutralLineColor(variant: ChartThemeVariant): string {
  if (variant === 'dark') return '#ffffff'
  if (variant === 'solarized-light') return '#073642'
  return '#111827'
}

export function chartNeutralLineRgb(variant: ChartThemeVariant): string {
  if (variant === 'dark') return '255, 255, 255'
  if (variant === 'solarized-light') return '7, 54, 66'
  return '17, 24, 39'
}

/** Plausible-style purple series. */
export const CHART_PURPLE_COLOR = '#6366f1'
export const CHART_PURPLE_RGB = '99, 102, 241'

/**
 * Neutral gray fills for a11y org bars / score chips (Plausible-style).
 * Hover uses chart purple; progress chip text is white on gray, black on purple.
 */
export const A11Y_BAR_FILL = '#2d2d32'
export const A11Y_BAR_FILL_HOVER = CHART_PURPLE_COLOR
/** Darker track behind the progress fill in All sites score chips / row hover. */
export const A11Y_BAR_TRACK = '#111114'
/** Score chip label on default (dark gray) fill. */
export const A11Y_BAR_TEXT = '#ffffff'
/** Score chip label on purple hover fill. Black for contrast on #6366f1. */
export const A11Y_BAR_TEXT_ON_HOVER = '#000000'

/** @deprecated Use A11Y_BAR_FILL */
export const A11Y_PURPLE_GRAY_FILL = A11Y_BAR_FILL
/** @deprecated Use A11Y_BAR_FILL_HOVER */
export const A11Y_PURPLE_GRAY_FILL_HOVER = A11Y_BAR_FILL_HOVER
/** @deprecated Use A11Y_BAR_TRACK */
export const A11Y_PURPLE_GRAY_TRACK = A11Y_BAR_TRACK

export function chartPurpleLineColor(_variant?: ChartThemeVariant): string {
  return CHART_PURPLE_COLOR
}

export function chartPurpleLineRgb(_variant?: ChartThemeVariant): string {
  return CHART_PURPLE_RGB
}

/**
 * Distinct colors for multi-series score trend overlays (Overall + WCAG levels).
 * Fixed hues so legend checkboxes stay stable across themes.
 */
export const SCORE_TREND_SERIES_COLORS = {
  overall: CHART_PURPLE_COLOR,
  a: '#0ea5e9',
  aa: '#10b981',
  aaa: '#f59e0b',
  bestPractices: '#ec4899'
} as const

export type ChartSeriesTone = 'accent' | 'neutral' | 'purple'

export function chartSeriesColor(
  variant: ChartThemeVariant,
  tone: ChartSeriesTone = 'accent'
): string {
  if (tone === 'neutral') return chartNeutralLineColor(variant)
  if (tone === 'purple') return chartPurpleLineColor(variant)
  return chartLineColor(variant)
}

export function chartSeriesRgb(
  variant: ChartThemeVariant,
  tone: ChartSeriesTone = 'accent'
): string {
  if (tone === 'neutral') return chartNeutralLineRgb(variant)
  if (tone === 'purple') return chartPurpleLineRgb(variant)
  return chartLineRgb(variant)
}



export function chartAreaFill(

  ctx: CanvasRenderingContext2D,

  chartArea: { top: number, bottom: number },

  peakOpacity = 0.5,

  lineRgb = CHART_LINE_RGB

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



  if (variant === 'solarized-light') {

    return {

      backgroundColor: '#eee8d5',

      titleColor: '#586e75',

      bodyColor: '#657b83',

      borderColor: '#d6cdb8',

      valueColor: '#073642'

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
  if (variant === 'dark') return 'rgb(19, 20, 24)' // --ui-bg dark
  if (variant === 'solarized-light') return '#fdf6e3' // --solarized-base3 / --ui-bg
  return '#ffffff'
}

/** Flat leading segment before first real data point (overview MetricTrendCard style). */
export function chartPlaceholderLineColor(variant: ChartThemeVariant): string {
  if (variant === 'dark') return 'rgba(148, 163, 184, 0.5)'
  if (variant === 'solarized-light') return 'rgba(88, 110, 117, 0.55)'
  return 'rgba(107, 114, 128, 0.5)'
}



export function chartAxisTickColor(variant: ChartThemeVariant): string {

  if (variant === 'dark') return 'rgba(255,255,255,0.35)'

  if (variant === 'solarized-light') return 'rgba(101,123,131,0.55)'

  return 'rgba(0,0,0,0.35)'

}



export function chartPointBorderColor(variant: ChartThemeVariant): string {

  if (variant === 'dark') return '#1a1a1a'

  if (variant === 'solarized-light') return '#fdf6e3'

  return '#ffffff'

}

/** Subtle plot-area grid lines for timeline charts. */
export function chartGridColor(variant: ChartThemeVariant): string {
  if (variant === 'dark') return 'rgba(255, 255, 255, 0.055)'
  if (variant === 'solarized-light') return 'rgba(7, 54, 66, 0.08)'
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

  /** Override series swatch color (defaults to accent green). */
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

