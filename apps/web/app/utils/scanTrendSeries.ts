import { eachDayOfInterval, format, startOfDay, subDays } from 'date-fns'
import type { Scan } from '~/types/sitenook'
import type { DateRangeBounds } from '~/utils/overviewDateRange'
import { averageScore } from '~/utils/dashboardAggregates'
import { scanTimestamp } from '~/utils/scanDisplay'

export interface TrendPoint {
  label: string
  value: number | null
}

function completedScansByDay(scans: Scan[]): Array<{ day: number, scan: Scan }> {
  const byDay = new Map<number, Scan>()
  for (const scan of scans) {
    if (scan.status !== 'complete' && scan.status !== 'complete_with_errors') continue
    const ts = scan.completed_at ?? scanTimestamp(scan)
    if (!ts) continue
    const day = startOfDay(new Date(ts)).getTime()
    const existing = byDay.get(day)
    if (!existing) {
      byDay.set(day, scan)
      continue
    }
    const existingTs = Date.parse(String(existing.completed_at ?? scanTimestamp(existing)))
    const nextTs = Date.parse(String(ts))
    if (nextTs >= existingTs) {
      byDay.set(day, scan)
    }
  }
  return [...byDay.entries()]
    .map(([day, scan]) => ({ day, scan }))
    .sort((a, b) => a.day - b.day)
}

export function buildDailyTrendSeries(
  scans: Scan[],
  readValue: (scan: Scan) => number | null | undefined,
  daysOrBounds: number | DateRangeBounds = 30
): TrendPoint[] {
  const completed = completedScansByDay(scans)
  const points: TrendPoint[] = []
  let lastValue: number | null = null
  let scanIdx = 0

  const days = eachDayInRange(daysOrBounds)

  for (const day of days) {
    const dayMs = day.getTime()
    while (scanIdx < completed.length && completed[scanIdx]!.day <= dayMs) {
      const raw = readValue(completed[scanIdx]!.scan)
      lastValue = raw == null ? lastValue : raw
      scanIdx++
    }
    points.push({
      label: format(day, 'MMM d'),
      value: lastValue
    })
  }

  return points
}

/**
 * Org-level average of per-site carried-forward scores for each day.
 * Days where no site has a known score yet are null.
 */
export function buildOrgAverageDailyTrend(
  scans: Scan[],
  readValue: (scan: Scan) => number | null | undefined,
  daysOrBounds: number | DateRangeBounds = 30
): TrendPoint[] {
  const days = eachDayInRange(daysOrBounds)
  if (!days.length) return []

  const bySite = new Map<string, Scan[]>()
  for (const scan of scans) {
    const siteId = typeof scan.site === 'string' ? scan.site : ''
    if (!siteId) continue
    const list = bySite.get(siteId)
    if (list) list.push(scan)
    else bySite.set(siteId, [scan])
  }

  if (!bySite.size) {
    return days.map(day => ({ label: format(day, 'MMM d'), value: null }))
  }

  const siteSeries = [...bySite.values()].map(siteScans =>
    buildDailyTrendSeries(siteScans, readValue, daysOrBounds)
  )

  return days.map((day, index) => {
    const dayValues = siteSeries.map(series => series[index]?.value ?? null)
    return {
      label: format(day, 'MMM d'),
      value: averageScore(dayValues)
    }
  })
}

/**
 * Org-level sum of per-site carried-forward values for each day (e.g. open issue counts).
 * Days where no site has a known value yet are null.
 */
export function buildOrgSumDailyTrend(
  scans: Scan[],
  readValue: (scan: Scan) => number | null | undefined,
  daysOrBounds: number | DateRangeBounds = 30
): TrendPoint[] {
  const days = eachDayInRange(daysOrBounds)
  if (!days.length) return []

  const bySite = new Map<string, Scan[]>()
  for (const scan of scans) {
    const siteId = typeof scan.site === 'string' ? scan.site : ''
    if (!siteId) continue
    const list = bySite.get(siteId)
    if (list) list.push(scan)
    else bySite.set(siteId, [scan])
  }

  if (!bySite.size) {
    return days.map(day => ({ label: format(day, 'MMM d'), value: null }))
  }

  const siteSeries = [...bySite.values()].map(siteScans =>
    buildDailyTrendSeries(siteScans, readValue, daysOrBounds)
  )

  return days.map((day, index) => {
    const dayValues = siteSeries.map(series => series[index]?.value ?? null)
    const known = dayValues.filter((v): v is number => v != null)
    return {
      label: format(day, 'MMM d'),
      value: known.length ? known.reduce((sum, n) => sum + n, 0) : null
    }
  })
}

function eachDayInRange(daysOrBounds: number | DateRangeBounds): Date[] {
  if (typeof daysOrBounds === 'number') {
    const result: Date[] = []
    for (let i = daysOrBounds - 1; i >= 0; i--) {
      result.push(startOfDay(subDays(new Date(), i)))
    }
    return result
  }
  return eachDayOfInterval({
    start: startOfDay(daysOrBounds.start),
    end: startOfDay(daysOrBounds.end)
  })
}

/**
 * Per-day event counts (zeros when none). Unlike score trends, values are not carried forward.
 */
export function buildDailyEventCountSeries(
  events: Array<{ loggedAt: string, count?: number }>,
  daysOrBounds: number | DateRangeBounds = 30
): TrendPoint[] {
  const days = eachDayInRange(daysOrBounds)
  const byDay = new Map<number, number>()

  for (const event of events) {
    const ms = Date.parse(event.loggedAt)
    if (!Number.isFinite(ms)) continue
    const dayMs = startOfDay(new Date(ms)).getTime()
    const add = event.count != null && event.count > 0 ? event.count : 1
    byDay.set(dayMs, (byDay.get(dayMs) ?? 0) + add)
  }

  return days.map(day => ({
    label: format(day, 'MMM d'),
    value: byDay.get(day.getTime()) ?? 0
  }))
}

export function sumTrendValues(points: TrendPoint[]): number {
  return points.reduce((sum, point) => sum + (point.value ?? 0), 0)
}

export function trendDelta(points: TrendPoint[]): number | null {
  const values = points.map(p => p.value).filter((v): v is number => v != null)
  if (values.length < 2) return null
  const first = values[0]!
  const last = values[values.length - 1]!
  return last - first
}

export function hasTrendData(points: TrendPoint[]): boolean {
  return points.some(p => p.value != null)
}

export function trendDataPointCount(points: TrendPoint[]): number {
  return points.filter(p => p.value != null).length
}

export function hasEnoughTrendData(points: TrendPoint[], minimum = 2): boolean {
  return trendDataPointCount(points) >= minimum
}
