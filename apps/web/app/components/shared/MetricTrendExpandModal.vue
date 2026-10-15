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
  chartPrimaryColor,
  chartPrimaryRgb,
  chartTooltipPalette,
  resolveChartThemeVariant
} from '~/utils/chartTheme'
import { buildCsv, downloadCsv, exportFilename } from '~/utils/csvExport'
import {
  buildBrokenLinksTrend,
  buildOpenIssuesTrend,
  buildQaScoreTrend,
  buildSeoIssuesTrend,
  buildSeoScoreTrend,
  brokenLinksLabelForMode,
  chartToPngDataUrl,
  downloadDataUrl,
  formatOpenIssuesValue,
  formatScoreTrendDelta,
  formatScoreTrendPercent,
  leadingPlaceholderInfo,
  openIssuesLabelForMode,
  pointDeltaVsPrevious,
  qaScoreLabelForMode,
  resolveIssuesYMax,
  scoreTrendSummaryStats,
  seoIssuesLabelForMode,
  seoScoreLabelForMode,
  type ScoreTrendExpandMode
} from '~/utils/scoreTrendExpand'
import {
  scoreTrendExpandBounds,
  type ScoreTrendExpandPreset,
  type ScoreTrendExpandRange
} from '~/utils/scoreTrendExpandRange'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

export type MetricTrendExpandKind =
  | 'open_issues'
  | 'broken_links'
  | 'qa_score'
  | 'seo_score'
  | 'seo_issues'

const props = withDefaults(defineProps<{
  kind: MetricTrendExpandKind
  mode: ScoreTrendExpandMode
  scans: Scan[]
  loading?: boolean
  title?: string
}>(), {
  loading: false,
  title: undefined
})

const open = defineModel<boolean>('open', { required: true })

const isScoreMetric = computed(() =>
  props.kind === 'qa_score' || props.kind === 'seo_score'
)
const deltaPositiveIsGood = computed(() =>
  props.kind === 'qa_score' || props.kind === 'seo_score'
)

const modalTitle = computed(() => {
  if (props.title) return props.title
  if (props.kind === 'broken_links') {
    return props.mode === 'org' ? 'Broken links (all sites)' : 'Broken links'
  }
  if (props.kind === 'qa_score') {
    return props.mode === 'org' ? 'Average QA score' : 'QA score trend'
  }
  if (props.kind === 'seo_score') {
    return props.mode === 'org' ? 'Average SEO score' : 'SEO score trend'
  }
  if (props.kind === 'seo_issues') {
    return props.mode === 'org' ? 'Open SEO issues (all sites)' : 'Open SEO issues'
  }
  return props.mode === 'org' ? 'Open issues (all sites)' : 'Open issues'
})

const modalDescription = computed(() => {
  if (props.kind === 'broken_links') return 'Drill down into broken links over time.'
  if (props.kind === 'qa_score') return 'Drill down into QA score over time.'
  if (props.kind === 'seo_score') return 'Drill down into SEO score over time.'
  if (props.kind === 'seo_issues') return 'Drill down into open SEO issues over time.'
  return 'Drill down into open accessibility issues over time.'
})

const seriesLabel = computed(() => {
  if (props.kind === 'broken_links') return brokenLinksLabelForMode(props.mode)
  if (props.kind === 'qa_score') return qaScoreLabelForMode(props.mode)
  if (props.kind === 'seo_score') return seoScoreLabelForMode(props.mode)
  if (props.kind === 'seo_issues') return seoIssuesLabelForMode(props.mode)
  return openIssuesLabelForMode(props.mode)
})

const periodAriaLabel = computed(() => {
  if (props.kind === 'broken_links') return 'Broken links trend period'
  if (props.kind === 'qa_score') return 'QA score trend period'
  if (props.kind === 'seo_score') return 'SEO score trend period'
  if (props.kind === 'seo_issues') return 'SEO issues trend period'
  return 'Open issues trend period'
})

const exportScope = computed(() => {
  const scope = props.mode === 'org' ? 'org' : 'site'
  if (props.kind === 'broken_links') return `${scope}-broken-links`
  if (props.kind === 'qa_score') return `${scope}-qa-score`
  if (props.kind === 'seo_score') return `${scope}-seo-score`
  if (props.kind === 'seo_issues') return `${scope}-seo-issues`
  return `${scope}-open-issues`
})

const exportBasename = computed(() => {
  if (props.kind === 'broken_links') return 'broken-links-trend'
  if (props.kind === 'qa_score') return 'qa-score-trend'
  if (props.kind === 'seo_score') return 'seo-score-trend'
  if (props.kind === 'seo_issues') return 'seo-issues-trend'
  return 'open-issues-trend'
})

function formatMetricValue(value: number | null): string {
  if (isScoreMetric.value) return formatScoreTrendPercent(value)
  return formatOpenIssuesValue(value)
}

const range = ref<ScoreTrendExpandRange>({ preset: 30 })
const customOpen = ref(false)
const draftStart = ref('')
const draftEnd = ref('')
const mounted = ref(false)
const chartKey = ref(0)
const chartRef = ref<{ chart?: Chart } | null>(null)

const colorMode = useColorMode()
const { primary } = usePrimaryColor()
const chartVariant = computed(() => resolveChartThemeVariant(colorMode.value))
const seriesColor = computed(() => chartPrimaryColor(primary.value))

const bounds = computed(() => scoreTrendExpandBounds(range.value))

const points = computed(() => {
  if (props.kind === 'broken_links') {
    return buildBrokenLinksTrend(props.scans, bounds.value, props.mode)
  }
  if (props.kind === 'qa_score') {
    return buildQaScoreTrend(props.scans, bounds.value, props.mode)
  }
  if (props.kind === 'seo_score') {
    return buildSeoScoreTrend(props.scans, bounds.value, props.mode)
  }
  if (props.kind === 'seo_issues') {
    return buildSeoIssuesTrend(props.scans, bounds.value, props.mode)
  }
  return buildOpenIssuesTrend(props.scans, bounds.value, props.mode)
})

const summary = computed(() => scoreTrendSummaryStats(points.value))

const labels = computed(() => points.value.map(p => p.label))

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
  value: string
  delta: string
}>({
  show: false,
  left: 0,
  top: 0,
  title: '',
  value: '',
  delta: ''
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

async function remountChart() {
  await nextTick()
  // Wait a frame so the modal has laid out before Chart.js measures the canvas.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  chartKey.value++
  await nextTick()
  chartRef.value?.chart?.resize()
}

watch(open, (isOpen) => {
  if (!isOpen) {
    hoverTooltip.value = { ...hoverTooltip.value, show: false }
    return
  }
  range.value = { preset: 30 }
  hoverTooltip.value = { ...hoverTooltip.value, show: false }
  void remountChart()
})

onMounted(async () => {
  await nextTick()
  mounted.value = true
})

watch(
  () => [bounds.value.dayCount, bounds.value.start.getTime(), bounds.value.end.getTime(), chartVariant.value, primary.value, props.scans] as const,
  () => {
    if (!mounted.value || !open.value) return
    void remountChart()
  }
)

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
  void primary.value
  const variant = chartVariant.value
  const placeholderColor = chartPlaceholderLineColor(variant)
  const lineRgb = chartPrimaryRgb(primary.value)
  const values = points.value.map(p => p.value)
  const pad = leadingPlaceholderInfo(points.value)
  const endIndex = lastPointIndex(values)
  const datasets: Array<Record<string, unknown>> = []

  if (pad) {
    datasets.push({
      label: seriesLabel.value,
      data: values.map((_, i) => (i <= pad.firstIndex ? pad.firstValue : null)),
      borderColor: placeholderColor,
      backgroundColor: 'transparent',
      borderWidth: 3,
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

  datasets.push({
    label: seriesLabel.value,
    data: mainData,
    borderColor: seriesColor.value,
    backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D, chartArea?: { top: number, bottom: number } } }) => {
      const { chart } = context
      const { ctx, chartArea } = chart
      if (!chartArea) return `rgba(${lineRgb}, 0.12)`
      return chartAreaFill(ctx, chartArea, 0.38, lineRgb)
    },
    borderWidth: 3,
    fill: true,
    tension: 0.35,
    spanGaps: false,
    pointRadius: (ctx: { dataIndex: number }) => (ctx.dataIndex === endIndex ? 4 : 0),
    pointHoverRadius: 5,
    pointBackgroundColor: seriesColor.value,
    pointBorderColor: chartPointBorderColor(variant),
    pointBorderWidth: 2,
    order: 2
  })

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

  const value = points.value[index]?.value ?? null
  if (value == null) {
    hoverTooltip.value = { ...hoverTooltip.value, show: false }
    return
  }

  const delta = pointDeltaVsPrevious(points.value, index)
  const gap = 14
  const approxWidth = 200
  const approxHeight = 68
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
    value: formatMetricValue(value),
    delta: formatScoreTrendDelta(delta)
  }
}

const issuesYMax = computed(() =>
  isScoreMetric.value ? 100 : resolveIssuesYMax(points.value)
)

const chartOptions = computed(() => {
  const variant = chartVariant.value
  const gridColor = chartGridColor(variant)
  const tickColor = variant === 'dark'
    ? 'rgba(255, 255, 255, 0.5)'
    : 'rgba(75, 85, 99, 0.9)'
  const yMax = issuesYMax.value

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
        max: yMax,
        display: true,
        grid: {
          display: true,
          color: gridColor,
          drawTicks: false
        },
        ticks: {
          color: tickColor,
          stepSize: yMax / 4
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
  const headers = ['Date', seriesLabel.value]
  const rows = points.value.map(point => [
    point.label,
    point.value == null ? '' : String(Math.round(point.value))
  ])
  const content = buildCsv(headers, rows)
  downloadCsv(exportFilename(exportBasename.value, exportScope.value), content)
}

function exportPng() {
  const chart = chartRef.value?.chart
  if (!chart?.canvas) return
  const dataUrl = chartToPngDataUrl(
    chart.canvas,
    chartExportBackgroundColor(chartVariant.value)
  )
  const date = new Date().toISOString().slice(0, 10)
  downloadDataUrl(`${exportBasename.value}-${exportScope.value}-${date}.png`, dataUrl)
}

/** For counts: up = worse. For QA score: up = better. */
const changeDisplay = computed(() => {
  const change = summary.value.change
  if (change == null) return { text: '—', direction: null as 'up' | 'down' | null, tone: 'neutral' as const }
  const text = formatScoreTrendDelta(change)
  if (change === 0) return { text, direction: null, tone: 'neutral' as const }
  const direction = change > 0 ? 'up' as const : 'down' as const
  const tone = deltaPositiveIsGood.value
    ? (change > 0 ? 'good' as const : 'bad' as const)
    : (change > 0 ? 'bad' as const : 'good' as const)
  return { text, direction, tone }
})

const tooltipPalette = computed(() => chartTooltipPalette(chartVariant.value))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="modalTitle"
    :description="modalDescription"
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
              {{ formatMetricValue(summary.current) }}
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/30 px-3 py-2.5">
            <p class="text-xs text-muted">
              Change
            </p>
            <p
              class="mt-0.5 inline-flex items-center gap-1 text-xl font-semibold tabular-nums"
              :class="changeDisplay.tone === 'good'
                ? 'text-success'
                : changeDisplay.tone === 'bad'
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
              {{ changeDisplay.text }}
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/30 px-3 py-2.5">
            <p class="text-xs text-muted">
              Min
            </p>
            <p class="mt-0.5 text-xl font-semibold tabular-nums text-highlighted">
              {{ formatMetricValue(summary.min) }}
            </p>
          </div>
          <div class="rounded-lg border border-default bg-elevated/30 px-3 py-2.5">
            <p class="text-xs text-muted">
              Max
            </p>
            <p class="mt-0.5 text-xl font-semibold tabular-nums text-highlighted">
              {{ formatMetricValue(summary.max) }}
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
              :aria-label="periodAriaLabel"
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
          aria-label="Visible series"
        >
          <label class="inline-flex items-center gap-2 text-sm text-default">
            <UCheckbox
              :model-value="true"
              disabled
            />
            <span
              class="inline-block size-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: seriesColor }"
              aria-hidden="true"
            />
            {{ seriesLabel }}
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
            <div class="flex items-center justify-between gap-3 text-xs tabular-nums">
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="inline-block size-2 rounded-full"
                  :style="{ backgroundColor: seriesColor }"
                  aria-hidden="true"
                />
                <span :style="{ color: tooltipPalette.bodyColor }">{{ seriesLabel }}</span>
              </span>
              <span class="font-medium" :style="{ color: tooltipPalette.valueColor }">
                {{ hoverTooltip.value }}
                <span
                  class="ms-1 font-normal"
                  :style="{ color: tooltipPalette.bodyColor }"
                >({{ hoverTooltip.delta }})</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
