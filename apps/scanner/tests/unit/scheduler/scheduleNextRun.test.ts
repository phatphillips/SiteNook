import { describe, it, expect } from 'vitest'
import {
  computeScheduleNextRunAt,
  computeScheduleNextRunAfterManualFullScan,
  getScheduleTimeFromConfig,
  getScheduleTimezoneFromConfig,
  isSiteDue,
  parseScheduleTime,
  rawConfigForEnqueue
} from '../../../src/scheduler/scheduleNextRun.js'

describe('parseScheduleTime', () => {
  it('defaults invalid input to 02:00', () => {
    expect(parseScheduleTime()).toEqual({ hour: 2, minute: 0 })
    expect(parseScheduleTime('bad')).toEqual({ hour: 2, minute: 0 })
  })

  it('parses HH:mm', () => {
    expect(parseScheduleTime('14:30')).toEqual({ hour: 14, minute: 30 })
  })
})

describe('getScheduleTimeFromConfig', () => {
  it('reads schedule.time from default_scan_config', () => {
    expect(
      getScheduleTimeFromConfig({ schedule: { frequency: 'daily', time: '09:15' } })
    ).toBe('09:15')
  })

  it('falls back to 14:00', () => {
    expect(getScheduleTimeFromConfig({})).toBe('14:00')
  })
})

describe('getScheduleTimezoneFromConfig', () => {
  it('reads schedule.timezone from config', () => {
    expect(
      getScheduleTimezoneFromConfig({ schedule: { timezone: 'Australia/Sydney' } })
    ).toBe('Australia/Sydney')
  })

  it('falls back when missing', () => {
    expect(getScheduleTimezoneFromConfig({}, 'UTC')).toBe('UTC')
  })
})

describe('computeScheduleNextRunAt', () => {
  it('returns null for manual', () => {
    expect(computeScheduleNextRunAt('manual')).toBeNull()
  })

  it('schedules hourly from anchor', () => {
    const from = new Date('2026-05-28T10:00:00.000Z')
    const now = new Date('2026-05-28T10:00:00.000Z')
    const next = computeScheduleNextRunAt('hourly', { from, now })
    expect(next).toBe('2026-05-28T11:00:00.000Z')
  })

  it('advances hourly when anchor is in the past', () => {
    const from = new Date('2026-05-28T08:00:00.000Z')
    const now = new Date('2026-05-28T10:30:00.000Z')
    const next = computeScheduleNextRunAt('hourly', { from, now })
    expect(new Date(next!).getTime()).toBeGreaterThan(now.getTime())
  })

  it('schedules daily at configured UTC time', () => {
    const from = new Date('2026-05-28T12:00:00.000Z')
    const now = new Date('2026-05-28T12:00:00.000Z')
    const next = computeScheduleNextRunAt('daily', {
      scheduleTime: '02:00',
      from,
      now,
      timeZone: 'UTC'
    })
    expect(next).toBe('2026-05-29T02:00:00.000Z')
  })

  it('schedules weekly seven days out at run time', () => {
    const from = new Date('2026-05-28T03:00:00.000Z')
    const now = new Date('2026-05-28T03:00:00.000Z')
    const next = computeScheduleNextRunAt('weekly', {
      scheduleTime: '02:00',
      from,
      now,
      timeZone: 'UTC'
    })
    expect(next).toBe('2026-06-04T02:00:00.000Z')
  })
})

describe('isSiteDue', () => {
  it('is false for manual', () => {
    expect(isSiteDue('manual', '2020-01-01T00:00:00.000Z')).toBe(false)
  })

  it('is false when next run is missing (not initialized)', () => {
    expect(isSiteDue('daily', null)).toBe(false)
  })

  it('is true when next run is in the past', () => {
    const now = new Date('2026-05-28T12:00:00.000Z')
    expect(isSiteDue('daily', '2026-05-27T12:00:00.000Z', now)).toBe(true)
  })

  it('is false when next run is in the future', () => {
    const now = new Date('2026-05-28T12:00:00.000Z')
    expect(isSiteDue('daily', '2026-05-29T12:00:00.000Z', now)).toBe(false)
  })
})

describe('rawConfigForEnqueue', () => {
  it('strips schedule metadata', () => {
    expect(
      rawConfigForEnqueue({ mode: 'full', schedule: { frequency: 'daily', time: '02:00' } })
    ).toEqual({ mode: 'full' })
  })

  it('defaults empty config to full crawl', () => {
    expect(rawConfigForEnqueue(null)).toEqual({ mode: 'full' })
  })
})

describe('computeScheduleNextRunAfterManualFullScan', () => {
  it('skips today scheduled slot when manual full scan runs before it', () => {
    const now = new Date('2026-05-28T10:00:00.000Z')
    const next = computeScheduleNextRunAfterManualFullScan('daily', {
      scheduleTime: '14:00',
      now,
      timeZone: 'UTC'
    })
    expect(next).toBe('2026-05-29T14:00:00.000Z')
  })

  it('advances hourly from now', () => {
    const now = new Date('2026-05-28T10:15:00.000Z')
    const next = computeScheduleNextRunAfterManualFullScan('hourly', { now })
    expect(next).toBe('2026-05-28T11:15:00.000Z')
  })

  it('returns null for manual sites', () => {
    expect(computeScheduleNextRunAfterManualFullScan('manual')).toBeNull()
  })
})
