import { describe, it, expect } from 'vitest'
import {
  computeScheduleNextRunAt,
  computeScheduleNextRunWithMinGap,
  formatCrawlScheduleLabel,
  formatNextScanLabel,
  getScheduleTimezoneFromConfig,
  isSiteDue
} from '~/utils/scheduleNextRun'

describe('formatNextScanLabel', () => {
  it('shows Manual for manual schedule', () => {
    expect(formatNextScanLabel('manual', null)).toBe('Manual')
  })

  it('shows Due now when past due', () => {
    expect(formatNextScanLabel('daily', '2020-01-01T00:00:00.000Z')).toBe('Due now')
  })
})

describe('computeScheduleNextRunAt (web)', () => {
  it('matches scanner hourly behavior', () => {
    const from = new Date('2026-05-28T10:00:00.000Z')
    expect(computeScheduleNextRunAt('hourly', { from, now: from })).toBe('2026-05-28T11:00:00.000Z')
  })
})

describe('isSiteDue (web)', () => {
  it('treats missing next run as due', () => {
    expect(isSiteDue('weekly', undefined)).toBe(false)
  })
})

describe('formatCrawlScheduleLabel', () => {
  it('shows Every 5 days for every_5d', () => {
    expect(formatCrawlScheduleLabel('every_5d')).toBe('Every 5 days')
  })
})

describe('computeScheduleNextRunWithMinGap (web)', () => {
  it('respects the minimum scan gap for short intervals', () => {
    const now = new Date('2026-05-28T10:00:00.000Z')
    const lastActivity = new Date('2026-05-28T09:55:00.000Z')
    const next = computeScheduleNextRunWithMinGap('hourly', { from: now, now }, lastActivity)
    expect(next).toBe('2026-05-28T11:00:00.000Z')
  })
})

describe('getScheduleTimezoneFromConfig (web)', () => {
  it('reads timezone from schedule object', () => {
    expect(
      getScheduleTimezoneFromConfig({ schedule: { timezone: 'Europe/London' } })
    ).toBe('Europe/London')
  })
})
