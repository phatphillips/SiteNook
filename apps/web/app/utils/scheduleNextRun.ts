export type CrawlSchedule =
  | 'manual'
  | 'hourly'
  | 'every_6h'
  | 'daily'
  | 'weekly'
  | 'monthly'

export interface ScheduleConfig {
  time?: string
  timezone?: string
}

const FALLBACK_TIMEZONE = 'UTC'

const INTERVAL_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  every_6h: 6 * 60 * 60 * 1000
}

const CALENDAR_SCHEDULES = new Set(['daily', 'weekly', 'monthly'])

export function parseScheduleTime(time?: string): { hour: number, minute: number } {
  if (!time || typeof time !== 'string') return { hour: 2, minute: 0 }
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match) return { hour: 2, minute: 0 }
  const hour = Math.min(23, Math.max(0, Number(match[1])))
  const minute = Math.min(59, Math.max(0, Number(match[2])))
  return { hour, minute }
}

export function getScheduleTimeFromConfig(
  defaultScanConfig: Record<string, unknown> | null | undefined
): string {
  const schedule = defaultScanConfig?.schedule
  if (schedule && typeof schedule === 'object' && 'time' in schedule) {
    const time = (schedule as ScheduleConfig).time
    if (typeof time === 'string' && time) return time
  }
  return '14:00'
}

export function getScheduleTimezoneFromConfig(
  defaultScanConfig: Record<string, unknown> | null | undefined,
  fallback: string = FALLBACK_TIMEZONE
): string {
  const schedule = defaultScanConfig?.schedule
  if (schedule && typeof schedule === 'object' && 'timezone' in schedule) {
    const tz = (schedule as ScheduleConfig).timezone
    if (typeof tz === 'string' && tz.trim()) return tz.trim()
  }
  return fallback
}

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second ?? 0)
  }
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0)
  for (let i = 0; i < 6; i++) {
    const p = getZonedParts(new Date(utc), timeZone)
    if (
      p.year === year
      && p.month === month
      && p.day === day
      && p.hour === hour
      && p.minute === minute
    ) {
      return new Date(utc)
    }
    const target = Date.UTC(year, month - 1, day, hour, minute, 0)
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
    utc += target - actual
  }
  return new Date(utc)
}

function addDaysToParts(parts: ZonedParts, days: number, timeZone: string): ZonedParts {
  const base = zonedTimeToUtc(parts.year, parts.month, parts.day, 12, 0, timeZone)
  const next = new Date(base.getTime() + days * 86_400_000)
  const p = getZonedParts(next, timeZone)
  return { ...p, hour: parts.hour, minute: parts.minute, second: parts.second }
}

function addMonthsToParts(parts: ZonedParts, months: number): ZonedParts {
  let month = parts.month + months
  let year = parts.year
  while (month > 12) {
    month -= 12
    year += 1
  }
  while (month < 1) {
    month += 12
    year -= 1
  }
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const day = Math.min(parts.day, maxDay)
  return { ...parts, year, month, day }
}

function addIntervalUntilAfter(from: Date, intervalMs: number, now: Date): Date {
  let next = new Date(from.getTime() + intervalMs)
  if (next <= now) {
    const elapsed = now.getTime() - from.getTime()
    const steps = Math.max(1, Math.ceil(elapsed / intervalMs))
    next = new Date(from.getTime() + steps * intervalMs)
    if (next <= now) {
      next = new Date(next.getTime() + intervalMs)
    }
  }
  return next
}

function nextCalendarSlot(
  frequency: 'daily' | 'weekly' | 'monthly',
  scheduleTime: string,
  timeZone: string,
  from: Date,
  now: Date
): Date {
  const { hour, minute } = parseScheduleTime(scheduleTime)
  const anchor = from > now ? from : now
  let parts = getZonedParts(anchor, timeZone)
  let candidate = zonedTimeToUtc(parts.year, parts.month, parts.day, hour, minute, timeZone)

  const advance = () => {
    const current = getZonedParts(candidate, timeZone)
    if (frequency === 'daily') {
      parts = addDaysToParts(current, 1, timeZone)
    } else if (frequency === 'weekly') {
      parts = addDaysToParts(current, 7, timeZone)
    } else {
      parts = addMonthsToParts(current, 1)
    }
    candidate = zonedTimeToUtc(parts.year, parts.month, parts.day, hour, minute, timeZone)
  }

  if (candidate <= from) advance()
  while (candidate <= now) advance()
  return candidate
}

export interface ComputeNextRunOptions {
  scheduleTime?: string
  from?: Date
  now?: Date
  timeZone?: string
}

export function computeScheduleNextRunAt(
  crawlSchedule: string,
  options: ComputeNextRunOptions = {}
): string | null {
  if (!crawlSchedule || crawlSchedule === 'manual') return null

  const now = options.now ?? new Date()
  const from = options.from ?? now
  const timeZone = options.timeZone ?? 'UTC'
  const scheduleTime = options.scheduleTime ?? '02:00'

  const intervalMs = INTERVAL_MS[crawlSchedule]
  if (intervalMs) {
    return addIntervalUntilAfter(from, intervalMs, now).toISOString()
  }

  if (CALENDAR_SCHEDULES.has(crawlSchedule)) {
    return nextCalendarSlot(
      crawlSchedule as 'daily' | 'weekly' | 'monthly',
      scheduleTime,
      timeZone,
      from,
      now
    ).toISOString()
  }

  return null
}

export function isSiteDue(
  crawlSchedule: string | undefined,
  scheduleNextRunAt: string | undefined | null,
  now: Date = new Date()
): boolean {
  if (!crawlSchedule || crawlSchedule === 'manual') return false
  if (!scheduleNextRunAt) return false
  return new Date(scheduleNextRunAt).getTime() <= now.getTime()
}

/**
 * After a manual full scan is queued, advance past the current scheduled slot
 * so the scheduler does not enqueue again for the same period (e.g. same day).
 */
export function computeScheduleNextRunAfterManualFullScan(
  crawlSchedule: string,
  options: ComputeNextRunOptions = {}
): string | null {
  if (!crawlSchedule || crawlSchedule === 'manual') return null

  const now = options.now ?? new Date()
  const timeZone = options.timeZone ?? 'UTC'
  const scheduleTime = options.scheduleTime ?? '02:00'

  if (CALENDAR_SCHEDULES.has(crawlSchedule)) {
    const { hour, minute } = parseScheduleTime(scheduleTime)
    const parts = getZonedParts(now, timeZone)
    const todaySlot = zonedTimeToUtc(parts.year, parts.month, parts.day, hour, minute, timeZone)
    const from = now < todaySlot ? todaySlot : now
    return computeScheduleNextRunAt(crawlSchedule, { ...options, from, now, timeZone, scheduleTime })
  }

  return computeScheduleNextRunAt(crawlSchedule, { ...options, from: now, now, timeZone, scheduleTime })
}

export function formatNextScanLabel(
  crawlSchedule: string | undefined,
  scheduleNextRunAt: string | undefined | null
): string {
  if (!crawlSchedule || crawlSchedule === 'manual') return 'Manual'
  if (!scheduleNextRunAt) return 'Pending'
  const at = new Date(scheduleNextRunAt)
  if (Number.isNaN(at.getTime())) return '—'
  if (at.getTime() <= Date.now()) return 'Due now'
  return at.toLocaleString()
}
