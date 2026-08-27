import type { Scan } from '~/types/sitenook'
import { SCORE_TREND_SERIES_COLORS } from '~/utils/chartTheme'
import { buildCsv } from '~/utils/csvExport'
import type { DateRangeBounds } from '~/utils/overviewDateRange'
import {
  buildDailyTrendSeries,
  buildOrgAverageDailyTrend,
  buildOrgSumDailyTrend,
  trendDelta,
  type TrendPoint
} from '~/utils/scanTrendSeries'

export type ScoreTrendSeriesId =
  | 'overall'
  | 'a'
  | 'aa'
  | 'aaa'
  | 'bestPractices'

export type ScoreTrendExpandMode = 'site' | 'org'

export interface ScoreTrendSeriesDef {
  id: ScoreTrendSeriesId
  label: string
  orgLabel: string
  field: keyof Pick<
    Scan,
    'score_overall' | 'score_a' | 'score_aa' | 'score_aaa' | 'score_best_practices'
  >
  color: string
  defaultVisible: boolean
}

export const SCORE_TREND_SERIES: ScoreTrendSeriesDef[] = [
  {
    id: 'overall',
    label: 'Overall',
    orgLabel: 'Avg overall',
    field: 'score_overall',
    color: SCORE_TREND_SERIES_COLORS.overall,
    defaultVisible: true
  },
  {
    id: 'a',
    label: 'WCAG A',
    orgLabel: 'Avg A',
    field: 'score_a',
    color: SCORE_TREND_SERIES_COLORS.a,
    defaultVisible: false
  },
  {
    id: 'aa',
    label: 'WCAG AA',
    orgLabel: 'Avg AA',
    field: 'score_aa',
    color: SCORE_TREND_SERIES_COLORS.aa,
    defaultVisible: false
  },
  {
    id: 'aaa',
    label: 'WCAG AAA',
    orgLabel: 'Avg AAA',
    field: 'score_aaa',
    color: SCORE_TREND_SERIES_COLORS.aaa,
    defaultVisible: false
  },
  {
    id: 'bestPractices',
    label: 'Best Practices',
    orgLabel: 'Avg Best Practices',
    field: 'score_best_practices',
    color: SCORE_TREND_SERIES_COLORS.bestPractices,
    defaultVisible: false
  }
]

export const OPEN_ISSUES_SERIES_COLOR = SCORE_TREND_SERIES_COLORS.aaa

export type ScoreTrendSeriesMap = Record<ScoreTrendSeriesId, TrendPoint[]>

function readScoreField(
  field: ScoreTrendSeriesDef['field']
): (scan: Scan) => number | null {
  return (scan) => {
    const value = scan[field]
    return typeof value === 'number' ? value : null
  }
}

export function seriesLabelForMode(
  def: ScoreTrendSeriesDef,
  mode: ScoreTrendExpandMode
): string {
  return mode === 'org' ? def.orgLabel : def.label
}

export function openIssuesLabelForMode(mode: ScoreTrendExpandMode): string {
  return mode === 'org' ? 'Open issues (all sites)' : 'Open issues'
}

export function defaultVisibleSeriesIds(): Set<ScoreTrendSeriesId> {
  return new Set(
    SCORE_TREND_SERIES.filter(s => s.defaultVisible).map(s => s.id)
  )
}

export function buildScoreTrendSeriesMap(
  scans: Scan[],
  bounds: DateRangeBounds,
  mode: ScoreTrendExpandMode
): ScoreTrendSeriesMap {
  const build = mode === 'org' ? buildOrgAverageDailyTrend : buildDailyTrendSeries
  const map = {} as ScoreTrendSeriesMap
  for (const def of SCORE_TREND_SERIES) {
    map[def.id] = build(scans, readScoreField(def.field), bounds)
  }
  return map
}

/** Site: daily carried-forward open count. Org: sum of per-site carried-forward counts. */
export function buildOpenIssuesTrend(
  scans: Scan[],
  bounds: DateRangeBounds,
  mode: ScoreTrendExpandMode
): TrendPoint[] {
  const read = (scan: Scan) => scan.open_issue_count ?? null
  if (mode === 'org') return buildOrgSumDailyTrend(scans, read, bounds)
  return buildDailyTrendSeries(scans, read, bounds)
}

export function brokenLinksLabelForMode(mode: ScoreTrendExpandMode): string {
  return mode === 'org' ? 'Broken links (all sites)' : 'Broken links'
}

export function qaScoreLabelForMode(mode: ScoreTrendExpandMode): string {
  return mode === 'org' ? 'Avg QA score' : 'QA score'
}

export function seoScoreLabelForMode(mode: ScoreTrendExpandMode): string {
  return mode === 'org' ? 'Avg SEO score' : 'SEO score'
}

export function seoIssuesLabelForMode(mode: ScoreTrendExpandMode): string {
  return mode === 'org' ? 'Open SEO issues (all sites)' : 'Open SEO issues'
}

/** Site: daily carried-forward broken-link count. Org: sum across sites. */
export function buildBrokenLinksTrend(
  scans: Scan[],
  bounds: DateRangeBounds,
  mode: ScoreTrendExpandMode
): TrendPoint[] {
  const read = (scan: Scan) => scan.broken_link_count ?? null
  if (mode === 'org') return buildOrgSumDailyTrend(scans, read, bounds)
  return buildDailyTrendSeries(scans, read, bounds)
}

/** Site: daily QA score. Org: average QA score across sites. */
export function buildQaScoreTrend(
  scans: Scan[],
  bounds: DateRangeBounds,
  mode: ScoreTrendExpandMode
): TrendPoint[] {
  const read = (scan: Scan) => scan.score_qa ?? null
  if (mode === 'org') return buildOrgAverageDailyTrend(scans, read, bounds)
  return buildDailyTrendSeries(scans, read, bounds)
}

/** Site: daily SEO score. Org: average SEO score across sites. */
export function buildSeoScoreTrend(
  scans: Scan[],
  bounds: DateRangeBounds,
  mode: ScoreTrendExpandMode
): TrendPoint[] {
  const read = (scan: Scan) => scan.score_seo ?? null
  if (mode === 'org') return buildOrgAverageDailyTrend(scans, read, bounds)
  return buildDailyTrendSeries(scans, read, bounds)
}

/** Site: daily carried-forward open SEO count. Org: sum across sites. */
export function buildSeoIssuesTrend(
  scans: Scan[],
  bounds: DateRangeBounds,
  mode: ScoreTrendExpandMode
): TrendPoint[] {
  const read = (scan: Scan) => scan.open_seo_count ?? null
  if (mode === 'org') return buildOrgSumDailyTrend(scans, read, bounds)
  return buildDailyTrendSeries(scans, read, bounds)
}

export interface ScoreTrendSummaryStats {
  current: number | null
  change: number | null
  min: number | null
  max: number | null
}

/** Summary for a numeric trend series over the selected range. */
export function scoreTrendSummaryStats(points: TrendPoint[]): ScoreTrendSummaryStats {
  const values = points.map(p => p.value).filter((v): v is number => v != null)
  if (!values.length) {
    return { current: null, change: null, min: null, max: null }
  }
  return {
    current: values[values.length - 1]!,
    change: trendDelta(points),
    min: Math.min(...values),
    max: Math.max(...values)
  }
}

/**
 * Leading flat segment before the first real value (overview MetricTrendCard pattern).
 * Returns null when there is no leading gap.
 */
export function leadingPlaceholderInfo(points: TrendPoint[]): {
  firstIndex: number
  firstValue: number
} | null {
  let firstIndex = -1
  for (let i = 0; i < points.length; i++) {
    if (points[i]?.value != null) {
      firstIndex = i
      break
    }
  }
  if (firstIndex <= 0) return null
  return { firstIndex, firstValue: points[firstIndex]!.value! }
}

/**
 * Delta vs the previous non-null point in the same series (for hover tooltips).
 * Returns null when there is no prior value.
 */
export function pointDeltaVsPrevious(
  points: TrendPoint[],
  index: number
): number | null {
  const current = points[index]?.value
  if (current == null) return null
  for (let i = index - 1; i >= 0; i--) {
    const prev = points[i]?.value
    if (prev != null) return current - prev
  }
  return null
}

export function formatScoreTrendDelta(delta: number | null): string {
  if (delta == null) return '—'
  if (delta === 0) return '0'
  const abs = Math.abs(delta)
  const rounded = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace(/\.0$/, '')
  const sign = delta > 0 ? '+' : '−'
  return `${sign}${rounded}`
}

export function formatScoreTrendPercent(value: number | null): string {
  if (value == null) return '—'
  return `${Math.round(value)}%`
}

export function formatOpenIssuesValue(value: number | null): string {
  if (value == null) return '—'
  return String(Math.round(value))
}

/** Nice y-max for open-issue counts (mirrors MetricTrendCard issues scale). */
export function resolveIssuesYMax(points: TrendPoint[]): number {
  const values = points.map(p => p.value).filter((v): v is number => v != null)
  if (!values.length) return 10
  const max = Math.max(...values)
  if (max <= 0) return 10
  const padded = Math.ceil(max * 1.1)
  if (padded <= 5) return 5
  if (padded <= 10) return 10
  if (padded <= 20) return 20
  if (padded <= 50) return 50
  return Math.ceil(padded / 10) * 10
}

export function buildScoreTrendCsv(
  seriesMap: ScoreTrendSeriesMap,
  visibleIds: Iterable<ScoreTrendSeriesId>,
  mode: ScoreTrendExpandMode,
  openIssues?: TrendPoint[]
): string {
  const visible = SCORE_TREND_SERIES.filter(s => [...visibleIds].includes(s.id))
  const labels = seriesMap.overall.map(p => p.label)
  const headers = [
    'Date',
    ...visible.map(s => seriesLabelForMode(s, mode)),
    ...(openIssues ? [openIssuesLabelForMode(mode)] : [])
  ]
  const rows = labels.map((label, index) => {
    const cells = [label]
    for (const def of visible) {
      const value = seriesMap[def.id][index]?.value
      cells.push(value == null ? '' : String(Math.round(value)))
    }
    if (openIssues) {
      const issueValue = openIssues[index]?.value
      cells.push(issueValue == null ? '' : String(Math.round(issueValue)))
    }
    return cells
  })
  return buildCsv(headers, rows)
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

/**
 * Chart.js canvases are transparent; composite onto a solid theme background for PNG export.
 */
export function chartToPngDataUrl(
  canvas: HTMLCanvasElement,
  backgroundColor: string
): string {
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = canvas.width
  exportCanvas.height = canvas.height
  const ctx = exportCanvas.getContext('2d')
  if (!ctx) return canvas.toDataURL('image/png')
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
  ctx.drawImage(canvas, 0, 0)
  return exportCanvas.toDataURL('image/png')
}

/** Stack multiple chart canvases vertically into one PNG with theme background. */
export function chartsToStackedPngDataUrl(
  canvases: HTMLCanvasElement[],
  backgroundColor: string,
  gap = 24
): string {
  const usable = canvases.filter(c => c.width > 0 && c.height > 0)
  if (!usable.length) return ''
  if (usable.length === 1) return chartToPngDataUrl(usable[0]!, backgroundColor)

  const width = Math.max(...usable.map(c => c.width))
  const height = usable.reduce((sum, c) => sum + c.height, 0) + gap * (usable.length - 1)
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = width
  exportCanvas.height = height
  const ctx = exportCanvas.getContext('2d')
  if (!ctx) return chartToPngDataUrl(usable[0]!, backgroundColor)

  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, width, height)
  let y = 0
  for (const canvas of usable) {
    const x = Math.round((width - canvas.width) / 2)
    ctx.drawImage(canvas, x, y)
    y += canvas.height + gap
  }
  return exportCanvas.toDataURL('image/png')
}
