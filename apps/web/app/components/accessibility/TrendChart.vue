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
import { format, subDays, startOfDay } from 'date-fns'
import type { Scan } from '~/types/accessiq'
import {
  buildChartTooltipOptions,
  chartAreaFill,
  chartAxisTickColor,
  chartLineColor,
  chartLineRgb,
  chartPointBorderColor,
  resolveChartThemeVariant
} from '~/utils/chartTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const props = defineProps<{
  scans: Scan[]
  /** Render as a section inside a parent card (no nested UCard). */
  embedded?: boolean
}>()

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
  () => props.scans,
  async () => {
    if (!mounted.value) return
    await nextTick()
    chartKey.value++
  },
  { deep: true }
)

const dailyScores = computed(() => {
  const completed = props.scans
    .filter(s => s.status === 'complete' && s.completed_at)
    .map(s => ({
      day: startOfDay(new Date(s.completed_at!)).getTime(),
      score: s.score_aa ?? s.score_a ?? 0
    }))
    .sort((a, b) => a.day - b.day)

  const points: { label: string, score: number | null }[] = []
  let lastScore: number | null = null
  let scanIdx = 0

  for (let i = 29; i >= 0; i--) {
    const day = startOfDay(subDays(new Date(), i))
    const dayMs = day.getTime()
    while (scanIdx < completed.length && completed[scanIdx]!.day <= dayMs) {
      lastScore = completed[scanIdx]!.score
      scanIdx++
    }
    points.push({
      label: format(day, 'MMM d'),
      score: lastScore
    })
  }

  return points
})

const hasData = computed(() =>
  props.scans.some(s => s.status === 'complete' && s.completed_at)
)

const chartData = computed(() => {
  const labels = dailyScores.value.map(p => p.label)
  const data = dailyScores.value.map(p => (hasData.value ? (p.score ?? 0) : null))
  const lineColor = chartLineColor(chartVariant.value)
  const lineRgb = chartLineRgb(chartVariant.value)

  return {
    labels,
    datasets: [{
      label: 'AA Score',
      data,
      borderColor: hasData.value ? lineColor : 'transparent',
      backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D, chartArea?: { top: number, bottom: number } } }) => {
        if (!hasData.value) return 'transparent'
        const { chart } = context
        const { ctx, chartArea } = chart
        if (!chartArea) return `rgba(${lineRgb}, 0.15)`
        return chartAreaFill(ctx, chartArea, 0.35, lineRgb)
      },
      fill: hasData.value,
      tension: 0.42,
      borderWidth: 2,
      spanGaps: false,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointBackgroundColor: lineColor,
      pointBorderColor: chartPointBorderColor(chartVariant.value),
      pointBorderWidth: 2
    }]
  }
})

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
      seriesLabel: 'AA Score',
      formatValue: (y) => `${y}%`,
      enabled: hasData.value
    })
  },
  scales: {
    y: {
      min: 0,
      max: 100,
      grid: { display: false },
      border: { display: false },
      ticks: {
        color: chartAxisTickColor(chartVariant.value),
        stepSize: 25,
        maxTicksLimit: 3,
        padding: 8
      }
    },
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: {
        color: chartAxisTickColor(chartVariant.value),
        maxTicksLimit: 6,
        padding: 8
      }
    }
  }
}))
</script>

<template>
  <UCard v-if="!embedded" :ui="{ root: 'overflow-visible', body: 'p-4 sm:p-6' }">
    <template #header>
      <h3 class="font-medium">Score trend (30 days)</h3>
    </template>
    <ClientOnly>
      <div class="trend-chart-container">
        <Line
          v-if="mounted"
          :key="chartKey"
          class="trend-chart-canvas"
          :data="chartData"
          :options="chartOptions"
        />
        <div
          v-if="!hasData"
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <p class="text-sm text-muted text-center px-6">
            No data yet
          </p>
        </div>
      </div>
      <template #fallback>
        <div class="trend-chart-container" aria-hidden="true" />
      </template>
    </ClientOnly>
  </UCard>
  <div v-else>
    <div class="p-4 sm:px-6">
      <h3 class="font-medium">Score trend (30 days)</h3>
    </div>
    <div class="p-4 sm:p-6">
      <ClientOnly>
        <div class="trend-chart-container">
          <Line
            v-if="mounted"
            :key="chartKey"
            class="trend-chart-canvas"
            :data="chartData"
            :options="chartOptions"
          />
          <div
            v-if="!hasData"
            class="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <p class="text-sm text-muted text-center px-6">
              No data yet
            </p>
          </div>
        </div>
        <template #fallback>
          <div class="trend-chart-container" aria-hidden="true" />
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
.trend-chart-container {
  position: relative;
  width: 100%;
  height: 220px;
  min-height: 220px;
  max-height: 220px;
  overflow: hidden;
}

.trend-chart-canvas {
  display: block;
  width: 100% !important;
  height: 220px !important;
  max-height: 220px;
}
</style>
