import { describe, expect, it, vi } from 'vitest'
import {
  computeReportScheduleAfterRun,
  computeShareExpiresAt,
  generateReportShareToken,
  isReportScheduleDue,
  REPORT_SHARE_TTL_DAYS
} from '../../../src/scheduler/reportScheduleScheduler.js'

describe('reportScheduleScheduler helpers', () => {
  it('generates opaque share tokens', () => {
    const a = generateReportShareToken()
    const b = generateReportShareToken()
    expect(a).toHaveLength(48)
    expect(b).toHaveLength(48)
    expect(a).not.toBe(b)
  })

  it('computes share expiry from TTL', () => {
    const from = new Date('2026-07-11T00:00:00.000Z')
    const expires = new Date(computeShareExpiresAt(from))
    expect((expires.getTime() - from.getTime()) / 86_400_000).toBe(REPORT_SHARE_TTL_DAYS)
  })

  it('marks due schedules correctly', () => {
    const now = new Date('2026-07-11T12:00:00.000Z')
    expect(isReportScheduleDue(true, '2026-07-11T11:59:00.000Z', now)).toBe(true)
    expect(isReportScheduleDue(true, null, now)).toBe(false)
    expect(isReportScheduleDue(false, '2026-07-11T11:59:00.000Z', now)).toBe(false)
  })

  it('disables once cadence after enqueue', () => {
    expect(computeReportScheduleAfterRun('once')).toEqual({
      next_run_at: null,
      enabled: false
    })
  })

  it('advances recurring cadence after enqueue', () => {
    const now = new Date('2026-07-11T10:00:00.000Z')
    const after = computeReportScheduleAfterRun('weekly', {
      scheduleTime: '09:00',
      timeZone: 'UTC',
      now,
      from: now
    })
    expect(after.enabled).toBe(true)
    expect(after.next_run_at).toBeTruthy()
    expect(new Date(after.next_run_at!).getTime()).toBeGreaterThan(now.getTime())
  })
})

describe('enqueueReportFromSchedule mapping', () => {
  it('creates a pending job with schedule link and share token', async () => {
    const created: Record<string, unknown>[] = []
    const updated: Record<string, unknown>[] = []
    const pb = {
      collection: (name: string) => ({
        create: async (payload: Record<string, unknown>) => {
          created.push({ collection: name, ...payload })
          return { id: 'job1', ...payload }
        },
        update: async (id: string, payload: Record<string, unknown>) => {
          updated.push({ collection: name, id, ...payload })
          return { id, ...payload }
        }
      })
    }

    const { enqueueReportFromSchedule } = await import('../../../src/scheduler/reportScheduleScheduler.js')
    const jobId = await enqueueReportFromSchedule(pb as never, {
      id: 'sched1',
      org: 'org1',
      site: 'site1',
      name: 'Weekly a11y',
      format: 'pdf',
      include_all_sites: false,
      sections: { accessibility: { issues: true } },
      cadence: 'weekly',
      schedule_time: '09:00',
      timezone: 'UTC',
      enabled: true,
      created_by: 'user1'
    }, new Date('2026-07-11T10:00:00.000Z'))

    expect(jobId).toBe('job1')
    expect(created[0]).toMatchObject({
      collection: 'report_jobs',
      org: 'org1',
      site: 'site1',
      schedule: 'sched1',
      format: 'pdf',
      status: 'pending'
    })
    expect(String(created[0]?.share_token || '')).toHaveLength(48)
    expect(updated[0]).toMatchObject({
      collection: 'report_schedules',
      id: 'sched1',
      last_job: 'job1',
      enabled: true
    })
  })

  it('disables one-time schedules after enqueue', async () => {
    const updated: Record<string, unknown>[] = []
    const pb = {
      collection: () => ({
        create: async (payload: Record<string, unknown>) => ({ id: 'job2', ...payload }),
        update: async (id: string, payload: Record<string, unknown>) => {
          updated.push({ id, ...payload })
          return { id, ...payload }
        }
      })
    }

    const { enqueueReportFromSchedule } = await import('../../../src/scheduler/reportScheduleScheduler.js')
    await enqueueReportFromSchedule(pb as never, {
      id: 'sched2',
      org: 'org1',
      name: 'Once',
      format: 'csv',
      include_all_sites: true,
      sections: { qa: { spelling: true } },
      cadence: 'once',
      enabled: true
    })

    expect(updated[0]).toMatchObject({
      id: 'sched2',
      enabled: false,
      next_run_at: null
    })
  })
})

// Silence console noise from enqueue success logs in this file
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
