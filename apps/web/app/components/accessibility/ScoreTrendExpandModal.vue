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
  type TooltipModel
} from 'chart.js'
import { format, parseISO, isValid } from 'date-fns'
import { Line } from 'vue-chartjs'
import type { Scan } from '~/types/sitenook'
import {
  chartAreaFill,
  chartExportBackgroundColor,
  chartGridColor,
  chartPlaceholderLineColor,
  chartPointBorderColor,
  chartPrimaryRgb,
  chartTooltipPalette,
  resolveChartThemeVariant
} from '~/utils/chartTheme'
import { downloadCsv, exportFilename } from '~/utils/csvExport'
import {
  SCORE_TREND_SERIES,
  buildScoreTrendCsv,
  buildScoreTrendSeriesMap,
  chartToPngDataUrl,
  colorForScoreTrendSeries,
  defaultVisibleSeriesIds,
  downloadDataUrl,
  formatScoreTrendDelta,
  formatScoreTrendPercent,
  leadingPlaceholderInfo,
  pointDeltaVsPrevious,
  scoreTrendSummaryStats,
  seriesLabelForMode,
  type ScoreTrendExpandMode,
  type ScoreTrendSeriesId
} from '~/utils/scoreTrendExpand'
import {
  scoreTrendExpandBounds,
  type ScoreTrendExpandPreset,
  type ScoreTrendExpandRange
} from '~/utils/scoreTrendExpandRange'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const props = withDefaults(defineProps<{
  mode: ScoreTrendExpandMode
  scans: Scan[]
  loading?: boolean
  title?: string
}>(), {
  loading: false,
  title: undefined
})

const open = defineModel<boolean>('open', { required: true })

const modalTitle = computed(() =>
  props.title
    ?? (props.mode === 'org' ? 'Average accessibility score' : 'Score trend')
)

const range = ref<ScoreTrendExpandRange>({ preset: 30 })
const visibleIds = ref<Set<ScoreTrendSeriesId>>(defaultVisibleSeriesIds())
const customOpen = ref(false)
const draftStart = ref('')
const draftEnd = ref('')
const mounted = ref(false)
const chartKey = ref(0)
const chartRef = ref<{ chart?: Chart } | null>(null)

const colorMode = useColorMode()
const { primary } = usePrimaryColor()
const chartVariant = computed(() => resolveChartThemeVariant(colorMode.value))

const bounds = computed(() => scoreTrendExpandBounds(range.value))

const seriesMap = computed(() =>
  buildScoreTrendSeriesMap(props.scans, bounds.value, props.mode)
)

const summary = computed(() => scoreTrendSummaryStats(seriesMap.value.overall))

const labels = computed(() => seriesMap.value.overall.map(p => p.label))

const presetTabItems = [
  { label: '7d', value: '7' },
  { label: '30d', value: '30' },
  { label: '90d', value: '90' },
  { label: '12mo', value: '365' }
]

const activePreset = computed({
  get(): string {
    const preset = range.value.preset
    if (preset === 'custom') return ''
    return String(preset)
  },
  set(value: string) {
    const parsed = Number(value)
    if (parsed === 7 || parsed === 30 || parsed === 90 || parsed === 365) {
      selectPreset(parsed)
    }
  }
})

const hoverTooltip = ref<{
  show: boolean
  left: number
  top: number
  title: string
  rows: Array<{ label: string, value: string, delta: string, color: string }>
}>({
  show: false,
  left: 0,
  top: 0,
  title: '',
  rows: []
})

const exportItems = computed(() => [[
  {
    label: 'Export PNG',
    icon: 'i-lucide-image',
    onSelect: () => exportPng()
  },
  {
    label: 'Export CSV',
    icon: 'i-lucide-file-spreadsheet',
    onSelect: () => exportCsv()
  }
]])

watch(open, (isOpen) => {
  if (isOpen) {
    range.value = { preset: 30 }
    visibleIds.value = defaultVisibleSeriesIds()
    hoverTooltip.value = { ...hoverTooltip.value, show: false }
  }
})

onMounted(async () => {
  await nextTick()
  mounted.value = true
})

watch(
  () => [seriesMap.value, visibleIds.value, chartVariant.value, primary.value, open.value] as const,
  async () => {
    if (!mounted.value || !open.value) return
    await nextTick()
    chartKey.value++
  },
  { deep: true }
)

function isVisible(id: ScoreTrendSeriesId): boolean {
  return visibleIds.value.has(id)
}

function toggleSeries(id: ScoreTrendSeriesId, checked: boolean | 'indeterminate') {
  const next = new Set(visibleIds.value)
  if (checked === true) {
    next.add(id)
  } else {
    if (id === 'overall') return
    next.delete(id)
  }
  if (!next.has('overall') && next.size === 0) {
    next.add('overall')
  }
  visibleIds.value = next
}

function selectPreset(preset: Exclude<ScoreTrendExpandPreset, 'custom'>) {
  range.value = { preset }
}

function openCustom() {
  const b = scoreTrendExpandBounds(range.value)
  draftStart.value = format(b.start, 'yyyy-MM-dd')
  draftEnd.value = format(b.end, 'yyyy-MM-dd')
  customOpen.value = true
}

function applyCustom() {
  const start = parseISO(draftStart.value)
  const end = parseISO(draftEnd.value)
  if (!isValid(start) || !isValid(end) || start > end) return
  range.value = {
    preset: 'custom',
    customStart: start,
    customEnd: end
  }
  customOpen.value = false
}

watch(
  () => range.value.preset,
  (preset) => {
    if (preset !== 'custom') customOpen.value = false
  }
)

function lastPointIndex(values: Array<number | null>): number {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return i
  }
  return -1
}

const chartData = computed(() => {
  const variant = chartVariant.value
  const placeholderColor = chartPlaceholderLineColor(variant)
  // Re-read when primary changes (watched via `primary` → chartKey remount).
  void primary.value
  const datasets: Array<Record<string, unknown>> = []

  for (const def of SCORE_TREND_SERIES) {
    if (!isVisible(def.id)) continue
    const points = seriesMap.value[def.id]
    const values = points.map(p => p.value)
    const pad = leadingPlaceholderInfo(points)
    const endIndex = lastPointIndex(values)
    const color = colorForScoreTrendSeries(def.id)

    if (pad) {
      datasets.push({
        label: seriesLabelForMode(def, props.mode),
        seriesId: def.id,
        data: values.map((_, i) => (i <= pad.firstIndex ? pad.firstValue : null)),
        borderColor: placeholderColor,
        backgroundColor: 'transparent',
        borderWidth: def.id === 'overall' ? 3 : 2,
        fill: false,
        tension: 0,
        spanGaps: false,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 1
      })
    }

    const mainData = pad
      ? values.map((v, i) => (i < pad.firstIndex ? null : v))
      : values

    const lineRgb = chartPrimaryRgb(primary.value)
    const usePrimaryFill = def.id === 'overall'

    datasets.push({
      label: seriesLabelForMode(def, props.mode),
      seriesId: def.id,
      data: mainData,
      borderColor: color,
      backgroundColor: usePrimaryFill
        ? (context: { chart: { ctx: CanvasRenderingContext2D, chartArea?: { top: number, bottom: number } } }) => {
            const { chart } = context
            const { ctx, chartArea } = chart
            if (!chartArea) return `rgba(${lineRgb}, 0.12)`
            return chartAreaFill(ctx, chartArea, 0.34, lineRgb)
          }
        : 'transparent',
      borderWidth: def.id === 'overall' ? 3 : 2,
      fill: usePrimaryFill,
      tension: 0.35,
      spanGaps: false,
      pointRadius: (ctx: { dataIndex: number }) => (ctx.dataIndex === endIndex ? 4 : 0),
      pointHoverRadius: 5,
      pointBackgroundColor: color,
      pointBorderColor: chartPointBorderColor(variant),
      pointBorderWidth: 2,
      order: 2
    })
  }

  return {
    labels: labels.value,
    datasets
  }
})

function externalTooltipHandler(context: {
  chart: Chart
  tooltip: TooltipModel<ChartType>
}) {
  const { chart, tooltip } = context
  if (tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
    hoverTooltip.value = { ...hoverTooltip.value, show: false }
    return
  }

  const index = tooltip.dataPoints[0]?.dataIndex
  if (index == null) {
    hoverTooltip.value = { ...hoverTooltip.value, show: false }
    return
  }

  const active = chart.getActiveElements()[0]?.element
  if (!active || active.x == null || active.y == null) {
    hoverTooltip.value = { ...hoverTooltip.value, show: false }
    return
  }

  const rows = SCORE_TREND_SERIES
    .filter(def => isVisible(def.id))
    .map((def) => {
      const points = seriesMap.value[def.id]
      const value = points[index]?.value ?? null
      const delta = pointDeltaVsPrevious(points, index)
      return {
        label: seriesLabelForMode(def, props.mode),
        value: formatScoreTrendPercent(value),
        delta: value == null ? '—' : formatScoreTrendDelta(delta),
        color: colorForScoreTrendSeries(def.id)
      }
    })
    .filter(row => row.value !== '—')

  if (!rows.length) {
    hoverTooltip.value = { ...hoverTooltip.value, show: false }
    return
  }

  const gap = 14
  const approxWidth = 220
  const approxHeight = 28 + rows.length * 22
  let left = active.x + gap
  if (left + approxWidth > chart.width) {
    left = active.x - approxWidth - gap
  }
  let top = active.y - approxHeight - 10
  if (top < -8) top = active.y + 14

  hoverTooltip.value = {
    show: true,
    left,
    top,
    title: String(labels.value[index] ?? ''),
    rows
  }
}

const chartOptions = computed(() => {
  const variant = chartVariant.value
  const gridColor = chartGridColor(variant)
  const tickColor = variant === 'dark'
    ? 'rgba(255, 255, 255, 0.5)'
    : 'rgba(75, 85, 99, 0.9)'

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    layout: {
      padding: { top: 8, right: 12, bottom: 8, left: 8 }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: externalTooltipHandler
      }
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: true,
          color: gridColor,
          drawTicks: false
        },
        ticks: {
          color: tickColor,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: bounds.value.dayCount > 90 ? 8 : 12
        },
        border: { display: false }
      },
      y: {
        min: 0,
        max: 100,
        display: true,
        grid: {
          display: true,
          color: gridColor,
          drawTicks: false
        },
        ticks: {
          color: tickColor,
          stepSize: 25,
          callback: (value: string | number) => `${value}%`
        },
        border: { display: false }
      }
    }
  }
})

function onChartLeave() {
  hoverTooltip.value = { ...hoverTooltip.value, show: false }
}

function exportCsv() {
  const content = buildScoreTrendCsv(seriesMap.value, visibleIds.value, props.mode)
  const scope = props.mode === 'org' ? 'org-score-trend' : 'site-score-trend'
  downloadCsv(exportFilename('score-trend', scope), content)
}

function exportPng() {
  const chart = chartRef.value?.chart
  if (!chart?.canvas) return
  const dataUrl = chartToPngDataUrl(
    chart.canvas,
    chartExportBackgroundColor(chartVariant.value)
  )
  const scope = props.mode === 'org' ? 'org-score-trend' : 'site-score-trend'
  const date = new Date().toISOString().slice(0, 10)
  downloadDataUrl(`score-trend-${scope}-${date}.png`, dataUrl)
}

const changeDisplay = computed(() => {
  const change = summary.value.change
  if (change == null) return { text: '—', direction: null as 'up' | 'down' | null }
  const text = formatScoreTrendDelta(change)
  if (change === 0) return { text, direction: null }
  return { text, direction: change > 0 ? 'up' as const : 'down' as const }
})

const tooltipPalette = computed(() => chartTooltipPalette(chartVariant.value))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="modalTitle"
    description="Drill down into accessibility score trends over time."
    :ui="{
      content: 'sm:max-w-[min(96vw,72rem)] w-full',
      description: 'sr-only'
    }"
  >
    <template #body>
      <div class="space-y-5">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-lg border border-default bg-elevated/30 px-3 py-2.5">
            <p class="text-xs text-muted">
              Current
            </p>
            <p class="mt-0.5 text-xl font-semibold tabular-nums text-highlighted">
              {{ formatScoreTrendPercent(summary.current) }}
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/30 px-3 py-2.5">
            <p class="text-xs text-muted">
              Change
            </p>
            <p
              class="mt-0.5 inline-flex items-center gap-1 text-xl font-semibold tabular-nums"
              :class="changeDisplay.direction === 'up'
                ? 'text-success'
                : changeDisplay.direction === 'down'
                  ? 'text-error'
                  : 'text-highlighted'"
            >
              <UIcon
                v-if="changeDisplay.direction === 'up'"
                name="i-lucide-arrow-up"
                class="size-4"
                aria-hidden="true"
              />
              <UIcon
                v-else-if="changeDisplay.direction === 'down'"
                name="i-lucide-arrow-down"
                class="size-4"
                aria-hidden="true"
              />
              {{ changeDisplay.text }}{{ summary.change != null ? '%' : '' }}
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/30 px-3 py-2.5">
            <p class="text-xs text-muted">
              Min
            </p>
            <p class="mt-0.5 text-xl font-semibold tabular-nums text-highlighted">
              {{ formatScoreTrendPercent(summary.min) }}
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/30 px-3 py-2.5">
            <p class="text-xs text-muted">
              Max
            </p>
            <p class="mt-0.5 text-xl font-semibold tabular-nums text-highlighted">
              {{ formatScoreTrendPercent(summary.max) }}
            </p>
          </div>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <UTabs
              v-model="activePreset"
              :content="false"
              :items="presetTabItems"
              color="neutral"
              size="sm"
              class="overview-date-range-tabs h-8 shrink-0"
              :ui="{
                list: 'relative flex h-8 w-auto p-0.5 rounded-lg bg-elevated border border-default',
                indicator: 'inset-y-0.5 rounded-md shadow-sm bg-default',
                trigger: [
                  'h-7 grow justify-center px-2.5 text-sm font-medium min-w-0',
                  'data-[state=inactive]:text-muted hover:data-[state=inactive]:not-disabled:text-default',
                  'data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-highlighted'
                ].join(' ')
              }"
            />

            <UPopover v-model:open="customOpen">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                class="h-8"
                :aria-pressed="range.preset === 'custom'"
                :ui="{
                  base: range.preset === 'custom'
                    ? 'h-8 border border-default ring-1 ring-primary/30'
                    : 'h-8'
                }"
                @click="openCustom"
              >
                Custom
                <UIcon name="i-lucide-chevron-down" class="ms-1 size-4 opacity-80" aria-hidden="true" />
              </UButton>

              <template #content>
                <div class="w-72 space-y-4 p-4">
                  <p class="text-sm font-medium">
                    Custom range
                  </p>
                  <div class="space-y-3">
                    <UFormField label="Start">
                      <UInput
                        v-model="draftStart"
                        type="date"
                        size="sm"
                      />
                    </UFormField>
                    <UFormField label="End">
                      <UInput
                        v-model="draftEnd"
                        type="date"
                        size="sm"
                      />
                    </UFormField>
                  </div>
                  <div class="flex justify-end gap-2">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      @click="customOpen = false"
                    >
                      Cancel
                    </UButton>
                    <UButton
                      size="sm"
                      @click="applyCustom"
                    >
                      Apply
                    </UButton>
                  </div>
                </div>
              </template>
            </UPopover>
          </div>

          <UDropdownMenu
            :items="exportItems"
            :content="{ align: 'end' }"
          >
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-download"
              class="h-8 self-start"
            >
              Export
            </UButton>
          </UDropdownMenu>
        </div>

        <div
          class="flex flex-wrap gap-x-4 gap-y-2"
          role="group"
          aria-label="Visible score series"
        >
          <label
            v-for="def in SCORE_TREND_SERIES"
            :key="def.id"
            class="inline-flex items-center gap-2 text-sm text-default"
          >
            <UCheckbox
              :model-value="isVisible(def.id)"
              :disabled="def.id === 'overall'"
              @update:model-value="(v) => toggleSeries(def.id, v)"
            />
            <span
              class="inline-block size-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: colorForScoreTrendSeries(def.id) }"
              aria-hidden="true"
            />
            {{ seriesLabelForMode(def, mode) }}
          </label>
        </div>

        <div
          class="relative min-h-[320px] sm:min-h-[420px]"
          @mouseleave="onChartLeave"
        >
          <div
            v-if="loading"
            class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-default/60"
          >
            <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-muted" />
          </div>

          <ClientOnly>
            <div class="absolute inset-0">
              <Line
                v-if="mounted && open"
                ref="chartRef"
                :key="chartKey"
                :data="chartData"
                :options="chartOptions"
              />
            </div>
          </ClientOnly>

          <div
            v-show="hoverTooltip.show"
            class="pointer-events-none absolute z-20 min-w-[11rem] rounded-md border px-3 py-2 shadow-lg"
            :style="{
              left: `${hoverTooltip.left}px`,
              top: `${hoverTooltip.top}px`,
              backgroundColor: tooltipPalette.backgroundColor,
              borderColor: tooltipPalette.borderColor,
              color: tooltipPalette.titleColor
            }"
            role="tooltip"
          >
            <p class="mb-1.5 text-xs font-medium" :style="{ color: tooltipPalette.titleColor }">
              {{ hoverTooltip.title }}
            </p>
            <div
              v-for="(row, i) in hoverTooltip.rows"
              :key="i"
              class="flex items-center justify-between gap-3 text-xs tabular-nums"
            >
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="inline-block size-2 rounded-full"
                  :style="{ backgroundColor: row.color }"
                  aria-hidden="true"
                />
                <span :style="{ color: tooltipPalette.bodyColor }">{{ row.label }}</span>
              </span>
              <span class="font-medium" :style="{ color: tooltipPalette.valueColor }">
                {{ row.value }}
                <span
                  class="ms-1 font-normal"
                  :style="{ color: tooltipPalette.bodyColor }"
                >({{ row.delta }})</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
