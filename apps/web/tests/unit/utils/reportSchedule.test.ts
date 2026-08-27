import { describe, expect, it } from 'vitest'
import {
  computeOnceRunAt,
  computeReportScheduleAfterRun,
  computeReportScheduleNextRunAt,
  computeShareExpiresAt,
  formatNextReportRunLabel,
  formatReportCadenceLabel,
  isReportScheduleDue,
  isShareTokenValid,
  REPORT_SCHEDULE_SHARE_TTL_DAYS
} from '~/utils/reportSchedule'

describe('reportSchedule', () => {
  it('labels cadences', () => {
    expect(formatReportCadenceLabel('once')).toBe('Once')
    expect(formatReportCadenceLabel('every_5d')).toBe('Every 5 days')
  })

  it('computes a future once run from schedule time', () => {
    const now = new Date('2026-07-11T08:00:00.000Z')
    const next = computeOnceRunAt({
      scheduleTime: '09:00',
      timeZone: 'UTC',
      now
    })
    expect(new Date(next).getTime()).toBeGreaterThan(now.getTime())
  })

  it('uses explicit runAt when still in the future', () => {
    const now = new Date('2026-07-11T08:00:00.000Z')
    const runAt = '2026-07-12T15:00:00.000Z'
    expect(computeOnceRunAt({ runAt, now })).toBe(new Date(runAt).toISOString())
  })

  it('computes recurring next run via cadence', () => {
    const now = new Date('2026-07-11T08:00:00.000Z')
    const next = computeReportScheduleNextRunAt('weekly', {
      scheduleTime: '09:00',
      timeZone: 'UTC',
      now,
      from: now
    })
    expect(next).toBeTruthy()
    expect(new Date(next!).getTime()).toBeGreaterThan(now.getTime())
  })

  it('disables one-time schedules after run', () => {
    expect(computeReportScheduleAfterRun('once')).toEqual({
      next_run_at: null,
      enabled: false
    })
  })

  it('keeps recurring schedules enabled after run', () => {
    const now = new Date('2026-07-11T10:00:00.000Z')
    const after = computeReportScheduleAfterRun('daily', {
      scheduleTime: '09:00',
      timeZone: 'UTC',
      now,
      from: now
    })
    expect(after.enabled).toBe(true)
    expect(after.next_run_at).toBeTruthy()
  })

  it('detects due schedules', () => {
    const now = new Date('2026-07-11T12:00:00.000Z')
    expect(isReportScheduleDue(true, '2026-07-11T11:00:00.000Z', now)).toBe(true)
    expect(isReportScheduleDue(false, '2026-07-11T11:00:00.000Z', now)).toBe(false)
    expect(isReportScheduleDue(true, '2026-07-11T13:00:00.000Z', now)).toBe(false)
  })

  it('validates share tokens and expiry', () => {
    const now = new Date('2026-07-11T12:00:00.000Z')
    expect(isShareTokenValid('abc', '2026-07-12T12:00:00.000Z', now)).toBe(true)
    expect(isShareTokenValid('abc', '2026-07-10T12:00:00.000Z', now)).toBe(false)
    expect(isShareTokenValid('', '2026-07-12T12:00:00.000Z', now)).toBe(false)
  })

  it('computes share expiry TTL', () => {
    const from = new Date('2026-07-11T00:00:00.000Z')
    const expires = new Date(computeShareExpiresAt(from))
    const days = (expires.getTime() - from.getTime()) / 86_400_000
    expect(days).toBe(REPORT_SCHEDULE_SHARE_TTL_DAYS)
  })

  it('formats next run labels', () => {
    expect(formatNextReportRunLabel(false, '2026-07-12T00:00:00.000Z')).toBe('Paused')
    expect(formatNextReportRunLabel(true, '2000-01-01T00:00:00.000Z')).toBe('Due now')
  })
})
