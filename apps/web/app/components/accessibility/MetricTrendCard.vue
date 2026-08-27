<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type Chart,
  type ChartType,
  type Plugin,
  type TooltipModel
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { TrendPoint } from '~/utils/scanTrendSeries'
import { hasTrendData } from '~/utils/scanTrendSeries'
import {
  buildChartTooltipOptions,
  chartAreaFill,
  chartGridColor,
  chartPointBorderColor,
  chartSeriesColor,
  chartSeriesRgb,
  chartTooltipPalette,
  CHART_PURPLE_COLOR,
  resolveChartThemeVariant
} from '~/utils/chartTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

/** Vertical hover guide + active point drawn on top of the line/fill. */
const verticalCrosshairPlugin: Plugin<'line'> = {
  id: 'metricTrendVerticalCrosshair',
  afterDatasetsDraw(chart, _args, pluginOpts) {
    const active = chart.getActiveElements()
    if (!active.length) return
    const { ctx, chartArea } = chart
    if (!chartArea) return
    const el = active[0]?.element
    if (!el || el.x == null || el.y == null) return

    const opts = pluginOpts as {
      color?: string
      pointColor?: string
      pointBorderColor?: string
    }
    const stroke = opts.color ?? 'rgba(255, 255, 255, 0.75)'
    const pointColor = opts.pointColor ?? stroke
    const pointBorder = opts.pointBorderColor ?? '#ffffff'

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(el.x, chartArea.top)
    ctx.lineTo(el.x, chartArea.bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = stroke
    ctx.stroke()

    // Redraw hover point above the line, fill, and crosshair.
    ctx.beginPath()
    ctx.arc(el.x, el.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = pointColor
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = pointBorder
    ctx.stroke()
    ctx.restore()
  }
}

ChartJS.register(verticalCrosshairPlugin)

/** Dotted horizontal guides at 50% and 100% of the y-scale. */
const horizontalGuidesPlugin: Plugin<'line'> = {
  id: 'metricTrendHorizontalGuides',
  afterDraw(chart, _args, pluginOpts) {
    const opts = pluginOpts as {
      enabled?: boolean
      color?: string
      values?: number[]
    }
    if (!opts.enabled || !opts.values?.length) return

    const yScale = chart.scales.y
    const { ctx, chartArea } = chart
    if (!yScale || !chartArea) return

    const color = opts.color ?? 'rgba(255, 255, 255, 0.28)'

    ctx.save()
    ctx.setLineDash([3, 4])
    ctx.lineWidth = 1
    ctx.strokeStyle = color

    for (const value of opts.values) {
      const y = yScale.getPixelForValue(value)
      if (y < chartArea.top - 0.5 || y > chartArea.bottom - 0.5) continue
      ctx.beginPath()
      ctx.moveTo(chartArea.left, y)
      ctx.lineTo(chartArea.right, y)
      ctx.stroke()
    }

    ctx.restore()
  }
}

ChartJS.register(horizontalGuidesPlugin)

/** Small vertical tick at each day along the x-axis baseline. */
const dayAxisTicksPlugin: Plugin<'line'> = {
  id: 'metricTrendDayAxisTicks',
  afterDraw(chart, _args, pluginOpts) {
    const opts = pluginOpts as {
      enabled?: boolean
      color?: string
      length?: number
      longLength?: number
    }
    if (!opts.enabled) return

    const xScale = chart.scales.x
    const { ctx, chartArea } = chart
    if (!xScale || !chartArea) return

    const color = opts.color ?? 'rgba(255, 255, 255, 0.35)'
    const shortLength = opts.length ?? 4
    const longLength = opts.longLength ?? shortLength + 3
    const y = chartArea.bottom

    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.setLineDash([])

    for (let i = 0; i < xScale.ticks.length; i++) {
      const x = xScale.getPixelForTick(i)
      if (x < chartArea.left || x > chartArea.right) continue
      const tickLength = i % 2 === 1 ? longLength : shortLength
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + tickLength)
      ctx.stroke()
    }

    ctx.restore()
  }
}

ChartJS.register(dayAxisTicksPlugin)

function guideLineColor(variant: ReturnType<typeof resolveChartThemeVariant>): string {
  if (variant === 'dark') return 'rgba(255, 255, 255, 0.12)'
  if (variant === 'solarized-light') return 'rgba(7, 54, 66, 0.12)'
  return 'rgba(17, 24, 39, 0.1)'
}

function placeholderLineColor(variant: ReturnType<typeof resolveChartThemeVariant>): string {
  if (variant === 'dark') return 'rgba(148, 163, 184, 0.5)'
  if (variant === 'solarized-light') return 'rgba(88, 110, 117, 0.55)'
  return 'rgba(107, 114, 128, 0.5)'
}

function placeholderLineRgb(variant: ReturnType<typeof resolveChartThemeVariant>): string {
  if (variant === 'dark') return '148, 163, 184'
  if (variant === 'solarized-light') return '88, 110, 117'
  return '107, 114, 128'
}

function tickLabelColor(variant: ReturnType<typeof resolveChartThemeVariant>): string {
  if (variant === 'dark') return 'rgba(255, 255, 255, 0.5)'
  if (variant === 'solarized-light') return 'rgba(88, 110, 117, 0.9)'
  return 'rgba(75, 85, 99, 0.9)'
}

const props = withDefaults(defineProps<{
  title?: string | null
  value: string
  subtitle: string
  points: TrendPoint[]
  /** Tooltip label prefix, e.g. "Score" → "Score: 82%" */
  seriesLabel?: string
  formatTooltipValue?: (value: number) => string
  /** Top-right badge text (e.g. site trend cards). */
  deltaLabel?: string | null
  deltaPositiveIsGood?: boolean
  yMin?: number
  yMax?: number
  /** `purple` = Plausible-style; `neutral` = white/near-black; `accent` = green brand. */
  tone?: 'accent' | 'neutral' | 'purple'
  /** Subtle plot grid with soft edge fade (hides hard outer grid lines). */
  showGrid?: boolean
  /**
   * When set, shows a circular up/down icon beside the main value
   * (value itself should already be the formatted change, e.g. "0.29%").
   */
  trendDirection?: 'up' | 'down' | null
  /**
   * X-axis (start/end dates + baseline) and Y-axis (tick labels + dotted guides).
   */
  showAxes?: boolean
  /** Muted comparison copy beside the hero value, e.g. "vs 30 days ago". */
  comparisonLabel?: string | null
  /** Inline change amount next to the arrow, e.g. "1.34%" or "3". */
  trendDeltaText?: string | null
  /** Dotted horizontal guides: score = 25/50/100; quarters = 25/50/75/100% of ymax. */
  guideLinePreset?: 'default' | 'score' | 'quarters'
  /** Minimum height of the plot area in pixels. */
  chartMinHeight?: number
}>(), {
  title: null,
  seriesLabel: 'Value',
  deltaLabel: null,
  deltaPositiveIsGood: true,
  tone: 'accent',
  showGrid: false,
  trendDirection: null,
  showAxes: false,
  comparisonLabel: null,
  trendDeltaText: null,
  guideLinePreset: 'default',
  chartMinHeight: 120
})

const mounted = ref(false)
const chartKey = ref(0)
const colorMode = useColorMode()
const chartVariant = computed(() => resolveChartThemeVariant(colorMode.value))

const hoverTooltip = ref<{
  show: boolean
  left: number
  top: number
  title: string
  body: string
  swatch: string
}>({
  show: false,
  left: 0,
  top: 0,
  title: '',
  body: '',
  swatch: CHART_PURPLE_COLOR
})

onMounted(async () => {
  await nextTick()
  mounted.value = true
  chartKey.value++
})

watch(
  () => colorMode.value,
  async () => {
    if (!mounted.value) return
    await nextTick()
    chartKey.value++
  }
)

watch(
  () => [props.points, props.tone, props.showAxes, props.showGrid] as const,
  async () => {
    if (!mounted.value) return
    await nextTick()
    chartKey.value++
  },
  { deep: true }
)

const hasData = computed(() => hasTrendData(props.points))

/** Resolved y-axis max for issues charts (mid + top guides need a fixed ceiling). */
const resolvedYMax = computed(() => {
  if (props.yMax != null) return props.yMax
  const values = props.points
    .map(p => p.value)
    .filter((v): v is number => v != null)
  if (!values.length) return 10
  const max = Math.max(...values)
  if (max <= 0) return 10
  const padded = Math.ceil(max * 1.1)
  if (padded <= 5) return 5
  if (padded <= 10) return 10
  if (padded <= 20) return 20
  if (padded <= 50) return 50
  return Math.ceil(padded / 10) * 10
})

const horizontalGuideValues = computed(() => {
  const max = resolvedYMax.value
  if (props.guideLinePreset === 'score') return [25, 50, 100]
  if (props.guideLinePreset === 'quarters') {
    return [max * 0.25, max * 0.5, max * 0.75, max]
  }
  const mid = max / 2
  return [mid, max]
})

const yAxisStep = computed(() => {
  const max = resolvedYMax.value
  if (props.guideLinePreset === 'score') return 25
  if (props.guideLinePreset === 'quarters') return max / 4
  return max / 2
})

/** First day with data — leading null days get a flat gray placeholder segment. */
const leadingPlaceholder = computed(() => {
  const values = props.points.map(p => p.value)
  let firstIndex = -1
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null) {
      firstIndex = i
      break
    }
  }
  if (firstIndex <= 0) {
    return { active: false, firstIndex: 0, firstValue: null as number | null }
  }
  return { active: true, firstIndex, firstValue: values[firstIndex]! }
})

const tooltipPalette = computed(() => chartTooltipPalette(chartVariant.value))

const chartData = computed(() => {
  const variant = chartVariant.value
  const lineColor = chartSeriesColor(variant, props.tone)
  const lineRgb = chartSeriesRgb(variant, props.tone)
  const placeholderColor = placeholderLineColor(variant)
  const placeholderRgb = placeholderLineRgb(variant)
  const rawValues = props.points.map(p => (hasData.value ? p.value : null))
  const pad = leadingPlaceholder.value

  let lastPointIndex = -1
  for (let i = rawValues.length - 1; i >= 0; i--) {
    if (rawValues[i] != null) {
      lastPointIndex = i
      break
    }
  }

  const fillUnderLine = (
    rgb: string,
    opacity: number,
    context: { chart: { ctx: CanvasRenderingContext2D, chartArea?: { top: number, bottom: number } } }
  ) => {
    const { chart } = context
    const { ctx, chartArea } = chart
    if (!chartArea) return `rgba(${rgb}, ${opacity})`
    return chartAreaFill(ctx, chartArea, opacity, rgb)
  }

  const datasets: Array<Record<string, unknown>> = []

  if (pad.active && pad.firstValue != null) {
    datasets.push({
      label: props.seriesLabel,
      data: rawValues.map((_, i) => (i <= pad.firstIndex ? pad.firstValue : null)),
      borderColor: placeholderColor,
      borderWidth: 3,
      backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D, chartArea?: { top: number, bottom: number } } }) =>
        hasData.value ? fillUnderLine(placeholderRgb, 0.35, context) : 'transparent',
      fill: hasData.value,
      tension: 0,
      spanGaps: false,
      pointRadius: 0,
      pointHoverRadius: 0,
      order: 1
    })
  }

  const mainData = pad.active
    ? rawValues.map((v, i) => (i < pad.firstIndex ? null : v))
    : rawValues

  datasets.push({
    label: props.seriesLabel,
    data: mainData,
    borderColor: hasData.value ? lineColor : 'transparent',
    borderWidth: 3,
    backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D, chartArea?: { top: number, bottom: number } } }) => {
      if (!hasData.value) return 'transparent'
      return fillUnderLine(lineRgb, 0.42, context)
    },
    fill: hasData.value,
    tension: 0.35,
    spanGaps: false,
    pointRadius: (ctx: { dataIndex: number }) => (ctx.dataIndex === lastPointIndex ? 4 : 0),
    pointHoverRadius: (ctx: { dataIndex: number }) => (ctx.dataIndex === lastPointIndex ? 5 : 0),
    pointBackgroundColor: lineColor,
    pointBorderColor: chartPointBorderColor(variant),
    pointBorderWidth: 2,
    order: 2
  })

  return {
    labels: props.points.map(p => p.label),
    datasets
  }
})

function formatValue(value: number): string {
  return props.formatTooltipValue?.(value) ?? String(value)
}

function externalTooltipHandler(context: {
  chart: Chart
  tooltip: TooltipModel<ChartType>
}) {
  const { chart, tooltip } = context
  if (tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
    hoverTooltip.value = { ...hoverTooltip.value, show: false }
    return
  }

  const point = tooltip.dataPoints[0]!
  const y = point.parsed.y
  if (y == null) {
    hoverTooltip.value = { ...hoverTooltip.value, show: false }
    return
  }

  const active = chart.getActiveElements()[0]?.element
  if (!active || active.x == null || active.y == null) {
    hoverTooltip.value = { ...hoverTooltip.value, show: false }
    return
  }

  const title = String(point.label ?? '')
  const body = `${point.dataset.label ?? props.seriesLabel}  ${formatValue(y)}`
  const swatch = chartSeriesColor(chartVariant.value, props.tone)

  // Chart-local coords (tooltip lives in the chart shell, overflow visible).
  const gap = 14
  const approxWidth = 176
  const approxHeight = 68
  let left = active.x + gap
  if (left + approxWidth > chart.width) {
    left = active.x - approxWidth - gap
  }

  // Prefer above the point so the box clears the line and can bleed above the canvas.
  let top = active.y - approxHeight - 10
  if (top + approxHeight > chart.height - 4) {
    top = Math.max(-approxHeight + 8, chart.height - approxHeight - 4)
  }

  hoverTooltip.value = {
    show: true,
    left,
    top,
    title,
    body,
    swatch
  }
}

const chartOptions = computed(() => {
  const variant = chartVariant.value
  const gridColor = chartGridColor(variant)
  const softGrid = props.showGrid && !props.showAxes
    ? {
        display: true,
        color: gridColor,
        drawTicks: false,
        tickLength: 0,
        lineWidth: 1
      }
    : { display: false }

  const tickColor = tickLabelColor(variant)
  const guideColor = guideLineColor(variant)
  const yMax = resolvedYMax.value
  const yStep = yAxisStep.value
  const guideValues = horizontalGuideValues.value

  const baseTooltip = buildChartTooltipOptions({
    variant,
    seriesLabel: props.seriesLabel,
    formatValue: (y) => formatValue(y),
    enabled: hasData.value,
    seriesColor: chartSeriesColor(variant, props.tone)
  })

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    layout: {
      padding: props.showAxes
        ? { top: 0, right: 8, bottom: 6, left: 8 }
        : { top: 0, right: 8, bottom: 0, left: 8 }
    },
    plugins: {
      legend: { display: false },
      metricTrendHorizontalGuides: {
        enabled: props.showAxes,
        color: guideLineColor(variant),
        values: guideValues
      },
      metricTrendDayAxisTicks: {
        enabled: props.showAxes,
        color: guideColor,
        length: 4,
        longLength: 7
      },
      metricTrendVerticalCrosshair: {
        color: variant === 'dark'
          ? 'rgba(255, 255, 255, 0.75)'
          : variant === 'solarized-light'
            ? 'rgba(7, 54, 66, 0.45)'
            : 'rgba(17, 24, 39, 0.35)',
        pointColor: chartSeriesColor(variant, props.tone),
        pointBorderColor: chartPointBorderColor(variant)
      },
      tooltip: {
        ...baseTooltip,
        // Canvas tooltip off — HTML tooltip can sit beside the point and overflow.
        enabled: false,
        external: externalTooltipHandler
      }
    },
    scales: {
      x: {
        display: props.showAxes,
        border: {
          display: props.showAxes,
          color: guideColor,
          width: 1
        },
        ticks: props.showAxes
          ? {
              color: tickColor,
              font: { size: 11, weight: '500' as const },
              padding: 2,
              maxRotation: 0,
              minRotation: 0,
              autoSkip: false,
              /**
               * Only start + end dates — keeps the day axis readable.
               */
              callback(this: { getLabelForValue: (v: string | number) => string }, value: string | number, index: number, ticks: unknown[]) {
                if (index === 0 || index === ticks.length - 1) {
                  return this.getLabelForValue(value)
                }
                return ''
              }
            }
          : undefined,
        grid: softGrid
      },
      y: {
        display: props.showAxes,
        border: { display: false },
        min: props.yMin,
        max: yMax,
        beginAtZero: props.yMin === 0,
        grid: softGrid,
        ticks: props.showAxes
          ? {
              color: tickColor,
              font: { size: 11, weight: '500' as const },
              padding: 2,
              stepSize: yStep,
              callback(value: string | number) {
                const n = typeof value === 'number' ? value : Number(value)
                if (!Number.isFinite(n)) return ''
                return Number.isInteger(n) ? String(n) : n.toFixed(1)
              }
            }
          : undefined
      }
    }
  }
})

const trendIcon = computed(() => {
  if (props.trendDirection === 'up') return 'i-lucide-arrow-up'
  if (props.trendDirection === 'down') return 'i-lucide-arrow-down'
  return null
})

/** Inline delta color — green when direction is favorable for the metric. */
const inlineDeltaClass = computed(() => {
  if (!props.trendDirection) return 'text-muted'
  const up = props.trendDirection === 'up'
  const good = (up && props.deltaPositiveIsGood) || (!up && !props.deltaPositiveIsGood)
  return good ? 'text-success' : 'text-error'
})

const deltaTone = computed((): 'good' | 'bad' | 'neutral' => {
  if (!props.deltaLabel) return 'neutral'
  const positive = props.deltaLabel.startsWith('+')
  const negative = props.deltaLabel.startsWith('-')
  if (!positive && !negative) return 'neutral'
  const good = (positive && props.deltaPositiveIsGood) || (negative && !props.deltaPositiveIsGood)
  const bad = (positive && !props.deltaPositiveIsGood) || (negative && props.deltaPositiveIsGood)
  if (good) return 'good'
  if (bad) return 'bad'
  return 'neutral'
})

const deltaBadgeStyle = computed(() => {
  if (deltaTone.value === 'good') {
    return {
      color: CHART_PURPLE_COLOR,
      backgroundColor: 'rgba(99, 102, 241, 0.12)',
      borderColor: 'rgba(99, 102, 241, 0.45)'
    }
  }
  if (deltaTone.value === 'bad') {
    return {
      color: '#f87171',
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderColor: 'rgba(239, 68, 68, 0.45)'
    }
  }
  return {
    color: 'var(--ui-text-muted)',
    backgroundColor: 'var(--ui-bg-elevated)',
    borderColor: 'var(--ui-border)'
  }
})

function onChartLeave() {
  hoverTooltip.value = { ...hoverTooltip.value, show: false }
}
</script>

<template>
  <div class="relative flex h-full min-h-[220px] flex-col gap-3 overflow-visible rounded-lg border border-default bg-elevated/25 p-4 shadow-none ring-0 sm:p-5">
    <div
      v-if="title || deltaLabel || $slots['header-actions']"
      class="flex shrink-0 items-start justify-between gap-2"
    >
      <p
        v-if="title"
        class="text-base font-semibold text-highlighted"
      >
        {{ title }}
      </p>
      <div class="ml-auto flex shrink-0 items-center gap-2">
        <span
          v-if="deltaLabel"
          class="inline-flex max-w-[14rem] items-center rounded-md border border-default px-2 py-0.5 text-[11px] font-medium tabular-nums leading-snug"
          :style="deltaBadgeStyle"
        >
          {{ deltaLabel }}
        </span>
        <slot name="header-actions" />
      </div>
    </div>

    <div class="shrink-0">
      <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <p class="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-highlighted leading-none">
          {{ value }}
        </p>
        <span
          v-if="trendIcon"
          class="inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums"
          :class="inlineDeltaClass"
        >
          <UIcon :name="trendIcon" class="size-3.5" aria-hidden="true" />
          <span v-if="trendDeltaText">{{ trendDeltaText }}</span>
        </span>
        <span
          v-if="comparisonLabel"
          class="text-sm text-muted"
        >
          {{ comparisonLabel }}
        </span>
      </div>
      <p
        v-if="subtitle"
        class="mt-1.5 text-sm text-muted"
      >
        {{ subtitle }}
      </p>
    </div>

    <div
      class="relative flex-1 overflow-visible -mx-2 sm:-mx-3"
      :style="{ minHeight: `${chartMinHeight}px` }"
      @mouseleave="onChartLeave"
    >
      <ClientOnly>
        <div
          class="metric-trend-chart absolute inset-0 overflow-visible"
          :class="{ 'metric-trend-chart--grid': showGrid && !showAxes }"
        >
          <Line
            v-if="mounted"
            :key="chartKey"
            class="metric-trend-chart-canvas"
            :data="chartData"
            :options="chartOptions"
          />
          <div
            v-if="!hasData"
            class="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <p class="text-xs text-muted">
              No data yet
            </p>
          </div>
        </div>
        <template #fallback>
          <div class="absolute inset-0" aria-hidden="true" />
        </template>
      </ClientOnly>

      <div
        v-if="hoverTooltip.show"
        class="metric-trend-tooltip pointer-events-none absolute z-30 min-w-[9.5rem] rounded-lg border px-3 py-2 shadow-lg"
        :style="{
          left: `${hoverTooltip.left}px`,
          top: `${hoverTooltip.top}px`,
          backgroundColor: tooltipPalette.backgroundColor,
          borderColor: tooltipPalette.borderColor,
          color: tooltipPalette.bodyColor
        }"
      >
        <p
          class="text-xs font-semibold"
          :style="{ color: tooltipPalette.titleColor }"
        >
          {{ hoverTooltip.title }}
        </p>
        <p class="mt-1 flex items-center gap-2 text-sm">
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ backgroundColor: hoverTooltip.swatch }"
            aria-hidden="true"
          />
          <span>{{ hoverTooltip.body }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metric-trend-chart {
  width: 100%;
  height: 100%;
}

.metric-trend-chart-canvas {
  position: absolute !important;
  inset: 0;
  display: block;
  width: 100% !important;
  height: 100% !important;
  max-height: none !important;
}

/* Soften left/right/top grid rim; keep the baseline flush to the card bottom. */
.metric-trend-chart--grid .metric-trend-chart-canvas {
  mask-image:
    linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%),
    linear-gradient(to bottom, transparent 0%, #000 12%, #000 100%);
  mask-composite: intersect;
  -webkit-mask-image:
    linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%),
    linear-gradient(to bottom, transparent 0%, #000 12%, #000 100%);
  -webkit-mask-composite: source-in;
}
</style>
