import { eachDayOfInterval, format, startOfDay, subDays } from 'date-fns'
import type { Scan } from '~/types/accessiq'
import type { DateRangeBounds } from '~/utils/overviewDateRange'
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
