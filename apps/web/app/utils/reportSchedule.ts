import type { ReportScheduleCadence } from '~/types/reports'
import {
  computeScheduleNextRunAt,
  parseScheduleTime,
  getZonedParts,
  zonedTimeToUtc,
  type ComputeNextRunOptions
} from '~/utils/scheduleNextRun'

export const REPORT_SCHEDULE_SHARE_TTL_DAYS = 30

export const REPORT_SCHEDULE_CADENCE_LABELS: Record<ReportScheduleCadence, string> = {
  once: 'Once',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  every_5d: 'Every 5 days'
}

export function formatReportCadenceLabel(cadence: ReportScheduleCadence | string | undefined): string {
  if (!cadence) return '—'
  return REPORT_SCHEDULE_CADENCE_LABELS[cadence as ReportScheduleCadence] || String(cadence)
}

export function isRecurringReportCadence(cadence: ReportScheduleCadence): boolean {
  return cadence !== 'once'
}

export function computeOnceRunAt(
  options: {
    runAt?: string | null
    scheduleTime?: string
    timeZone?: string
    now?: Date
  } = {}
): string {
  const now = options.now ?? new Date()
  if (options.runAt) {
    const parsed = new Date(options.runAt)
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime()) {
      return parsed.toISOString()
    }
  }

  const timeZone = options.timeZone ?? 'UTC'
  const scheduleTime = options.scheduleTime ?? '09:00'
  const { hour, minute } = parseScheduleTime(scheduleTime)
  const parts = getZonedParts(now, timeZone)
  let candidate = zonedTimeToUtc(parts.year, parts.month, parts.day, hour, minute, timeZone)
  if (candidate.getTime() <= now.getTime()) {
    const tomorrow = new Date(candidate.getTime() + 86_400_000)
    const nextParts = getZonedParts(tomorrow, timeZone)
    candidate = zonedTimeToUtc(nextParts.year, nextParts.month, nextParts.day, hour, minute, timeZone)
  }
  return candidate.toISOString()
}

export function computeReportScheduleNextRunAt(
  cadence: ReportScheduleCadence,
  options: ComputeNextRunOptions & { runAt?: string | null } = {}
): string | null {
  if (cadence === 'once') {
    return computeOnceRunAt({
      runAt: options.runAt,
      scheduleTime: options.scheduleTime,
      timeZone: options.timeZone,
      now: options.now
    })
  }

  return computeScheduleNextRunAt(cadence, {
    scheduleTime: options.scheduleTime ?? '09:00',
    from: options.from,
    now: options.now,
    timeZone: options.timeZone ?? 'UTC'
  })
}

export function computeReportScheduleAfterRun(
  cadence: ReportScheduleCadence,
  options: ComputeNextRunOptions = {}
): { next_run_at: string | null, enabled: boolean } {
  if (cadence === 'once') {
    return { next_run_at: null, enabled: false }
  }

  const next = computeScheduleNextRunAt(cadence, {
    scheduleTime: options.scheduleTime ?? '09:00',
    from: options.from ?? options.now ?? new Date(),
    now: options.now ?? new Date(),
    timeZone: options.timeZone ?? 'UTC'
  })
  return { next_run_at: next, enabled: true }
}

export function isReportScheduleDue(
  enabled: boolean | undefined,
  nextRunAt: string | undefined | null,
  now: Date = new Date()
): boolean {
  if (!enabled) return false
  if (!nextRunAt) return false
  return new Date(nextRunAt).getTime() <= now.getTime()
}

export function generateReportShareToken(): string {
  const bytes = new Uint8Array(24)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export function computeShareExpiresAt(
  from: Date = new Date(),
  ttlDays = REPORT_SCHEDULE_SHARE_TTL_DAYS
): string {
  return new Date(from.getTime() + ttlDays * 86_400_000).toISOString()
}

export function isShareTokenValid(
  token: string | undefined | null,
  expiresAt: string | undefined | null,
  now: Date = new Date()
): boolean {
  if (!token || !token.trim()) return false
  if (!expiresAt) return true
  const expires = new Date(expiresAt)
  if (Number.isNaN(expires.getTime())) return false
  return expires.getTime() > now.getTime()
}

export function formatNextReportRunLabel(
  enabled: boolean | undefined,
  nextRunAt: string | undefined | null
): string {
  if (!enabled) return 'Paused'
  if (!nextRunAt) return '—'
  const at = new Date(nextRunAt)
  if (Number.isNaN(at.getTime())) return '—'
  if (at.getTime() <= Date.now()) return 'Due now'
  return at.toLocaleString()
}
