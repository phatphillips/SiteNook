/** Chart accent — data series only (not buttons or primary UI chrome). */

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



type TooltipCallbackCtx = {

  parsed: { y: number | null }

  dataset: { label?: string }

}



export function buildChartTooltipOptions(opts: {

  variant: ChartThemeVariant

  seriesLabel: string

  formatValue?: (value: number) => string

  enabled?: boolean

}) {

  const palette = chartTooltipPalette(opts.variant)

  const formatValue = opts.formatValue ?? ((v: number) => String(v))

  const lineColor = chartLineColor(opts.variant)



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

