import { endOfDay, startOfDay, subDays } from 'date-fns'
import type { DateRangeBounds } from '~/utils/overviewDateRange'

/** Expand-modal range presets (page overview stays on 30 | 90 | custom). */
export type ScoreTrendExpandPreset = 7 | 30 | 90 | 365 | 'custom'

export interface ScoreTrendExpandRange {
  preset: ScoreTrendExpandPreset
  customStart?: Date
  customEnd?: Date
}

export function scoreTrendExpandBounds(range: ScoreTrendExpandRange): DateRangeBounds {
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
  const days = typeof range.preset === 'number' ? range.preset : 30
  return {
    start: startOfDay(subDays(end, days - 1)),
    end,
    dayCount: days
  }
}

export function scoreTrendExpandPresetLabel(preset: ScoreTrendExpandPreset): string {
  if (preset === 7) return '7d'
  if (preset === 30) return '30d'
  if (preset === 90) return '90d'
  if (preset === 365) return '12mo'
  return 'Custom'
}
