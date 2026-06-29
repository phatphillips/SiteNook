<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { TrendPoint } from '~/utils/scanTrendSeries'
import { hasTrendData } from '~/utils/scanTrendSeries'
import {
  buildChartTooltipOptions,
  chartAreaFill,
  chartLineColor,
  chartLineRgb,
  chartPointBorderColor,
  resolveChartThemeVariant
} from '~/utils/chartTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const props = withDefaults(defineProps<{
  title: string
  value: string
  subtitle: string
  points: TrendPoint[]
  /** Tooltip label prefix, e.g. "Score" → "Score: 82%" */
  seriesLabel?: string
  formatTooltipValue?: (value: number) => string
  deltaLabel?: string | null
  deltaPositiveIsGood?: boolean
  yMin?: number
  yMax?: number
}>(), {
  seriesLabel: 'Value',
  deltaPositiveIsGood: true
})

const mounted = ref(false)
const chartKey = ref(0)
const colorMode = useColorMode()
const chartVariant = computed(() => resolveChartThemeVariant(colorMode.value))

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
  () => props.points,
  async () => {
    if (!mounted.value) return
    await nextTick()
    chartKey.value++
  },
  { deep: true }
)

const hasData = computed(() => hasTrendData(props.points))

const chartData = computed(() => {
  const lineColor = chartLineColor(chartVariant.value)
  const lineRgb = chartLineRgb(chartVariant.value)

  return {
    labels: props.points.map(p => p.label),
    datasets: [{
      label: props.seriesLabel,
      data: props.points.map(p => (hasData.value ? p.value : null)),
      borderColor: hasData.value ? lineColor : 'transparent',
      borderWidth: 2,
      backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D, chartArea?: { top: number, bottom: number } } }) => {
        if (!hasData.value) return 'transparent'
        const { chart } = context
        const { ctx, chartArea } = chart
        if (!chartArea) return `rgba(${lineRgb}, 0.12)`
        return chartAreaFill(ctx, chartArea, 0.5, lineRgb)
      },
      fill: hasData.value,
      tension: 0.42,
      spanGaps: false,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: lineColor,
      pointBorderColor: chartPointBorderColor(chartVariant.value),
      pointBorderWidth: 2
    }]
  }
})

function formatValue(value: number): string {
  return props.formatTooltipValue?.(value) ?? String(value)
}

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false
  },
  plugins: {
    legend: { display: false },
    tooltip: buildChartTooltipOptions({
      variant: chartVariant.value,
      seriesLabel: props.seriesLabel,
      formatValue: (y) => formatValue(y),
      enabled: hasData.value
    })
  },
  scales: {
    x: {
      display: false,
      grid: { display: false }
    },
    y: {
      display: false,
      min: props.yMin,
      max: props.yMax,
      grid: { display: false }
    }
  }
}))

const deltaClass = computed(() => {
  if (!props.deltaLabel) return 'text-muted'
  const positive = props.deltaLabel.startsWith('+')
  const negative = props.deltaLabel.startsWith('-')
  if (!positive && !negative) return 'text-muted'
  const good = (positive && props.deltaPositiveIsGood) || (negative && !props.deltaPositiveIsGood)
  const bad = (positive && !props.deltaPositiveIsGood) || (negative && props.deltaPositiveIsGood)
  if (good) return 'text-success'
  if (bad) return 'text-error'
  return 'text-muted'
})
</script>

<template>
  <UCard :ui="{ root: 'overflow-hidden bg-elevated/25 border border-default', body: 'p-4 sm:p-5 flex flex-col gap-3 min-h-[220px]' }">
    <div class="flex items-start justify-between gap-2">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {{ title }}
      </p>
      <slot name="header-actions" />
    </div>

    <div>
      <p class="text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight">
        {{ value }}
      </p>
      <p class="text-sm text-muted mt-0.5">
        {{ subtitle }}
      </p>
    </div>

    <ClientOnly>
      <div class="metric-trend-chart relative flex-1 min-h-[88px]">
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
        <div class="metric-trend-chart min-h-[88px]" aria-hidden="true" />
      </template>
    </ClientOnly>

    <p
      v-if="deltaLabel"
      class="text-xs tabular-nums"
      :class="deltaClass"
    >
      {{ deltaLabel }}
    </p>
  </UCard>
</template>

<style scoped>
.metric-trend-chart {
  width: 100%;
}

.metric-trend-chart-canvas {
  display: block;
  width: 100% !important;
  height: 88px !important;
  max-height: 88px;
}
</style>
