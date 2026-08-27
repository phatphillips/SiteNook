import { endOfDay, startOfDay, subDays } from 'date-fns'
import type { Scan } from '~/types/sitenook'
import { scanTimestamp } from '~/utils/scanDisplay'

export type OverviewRangePreset = 30 | 90 | 'custom'

export interface OverviewDateRange {
  preset: OverviewRangePreset
  /** Inclusive start (custom preset only). */
  customStart?: Date
  /** Inclusive end (custom preset only). */
  customEnd?: Date
}

export interface DateRangeBounds {
  start: Date
  end: Date
  /** Inclusive day count for trend series. */
  dayCount: number
}

export function overviewRangeBounds(range: OverviewDateRange): DateRangeBounds {
  const end = endOfDay(new Date())
  if (range.preset === 'custom' && range.customStart && range.customEnd) {
    const start = startOfDay(range.customStart)
    const customEnd = endOfDay(range.customEnd)
    const dayCount = Math.max(
      1,
      Math.round((startOfDay(customEnd).getTime() - start.getTime()) / 86_400_000) + 1
    )
    return { start, end: customEnd, dayCount }
  }
  const days = range.preset === 90 ? 90 : 30
  return {
    start: startOfDay(subDays(end, days - 1)),
    end,
    dayCount: days
  }
}

export function scanInDateRange(scan: Scan, bounds: DateRangeBounds): boolean {
  const ts = scanTimestamp(scan)
  if (!ts) return false
  const at = new Date(ts)
  return at >= bounds.start && at <= bounds.end
}

export function filterScansByDateRange(scans: Scan[], bounds: DateRangeBounds): Scan[] {
  return scans.filter(scan => scanInDateRange(scan, bounds))
}

export function rangePresetLabel(preset: OverviewRangePreset): string {
  if (preset === 90) return '90 days'
  if (preset === 'custom') return 'Custom'
  return '30 days'
}

export function deltaComparisonLabel(dayCount: number): string {
  return `vs ${dayCount} days ago`
}
