import { describe, expect, it, vi } from 'vitest'
import {
  scheduleVerificationScan,
  tickVerificationScans,
  VERIFICATION_DELAY_MS
} from '../../../src/scheduler/scanScheduler.js'

describe('verification scans', () => {
  it('schedules a verification 24h out when no sooner schedule exists', async () => {
    const update = vi.fn().mockResolvedValue({})
    const pb = {
      collection: vi.fn((name: string) => {
        if (name === 'sites') {
          return {
            getOne: vi.fn().mockResolvedValue({
              id: 'site1',
              crawl_schedule: 'manual',
              default_scan_config: {}
            }),
            update
          }
        }
        if (name === 'scan_queue') {
          return { getList: vi.fn().mockResolvedValue({ items: [] }) }
        }
        return { getList: vi.fn().mockResolvedValue({ items: [] }) }
      })
    }
    const now = new Date('2026-06-01T00:00:00.000Z')
    await scheduleVerificationScan(pb as never, 'site1', now)
    expect(update).toHaveBeenCalledWith('site1', {
      verification_due_at: new Date(now.getTime() + VERIFICATION_DELAY_MS).toISOString()
    })
  })

  it('skips scheduling when a regular run is already due within 24h', async () => {
    const update = vi.fn()
    const pb = {
      collection: vi.fn((name: string) => {
        if (name === 'sites') {
          return {
            getOne: vi.fn().mockResolvedValue({
              id: 'site1',
              crawl_schedule: 'daily',
              schedule_next_run_at: '2026-06-01T08:00:00.000Z',
              default_scan_config: {}
            }),
            update
          }
        }
        return { getList: vi.fn().mockResolvedValue({ items: [] }) }
      })
    }
    await scheduleVerificationScan(pb as never, 'site1', new Date('2026-06-01T00:00:00.000Z'))
    expect(update).not.toHaveBeenCalled()
  })

  it('enqueues a one-off scan when verification is due', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'q1' })
    const update = vi.fn().mockResolvedValue({})
    const pb = {
      collection: vi.fn((name: string) => {
        if (name === 'sites') {
          return {
            getFullList: vi.fn().mockResolvedValue([{
              id: 'site1',
              default_scan_config: {},
              verification_due_at: '2026-06-01T00:00:00.000Z'
            }]),
            update
          }
        }
        if (name === 'scan_queue') {
          return {
            getList: vi.fn().mockResolvedValue({ items: [] }),
            create
          }
        }
        return { getList: vi.fn().mockResolvedValue({ items: [] }) }
      })
    }
    await tickVerificationScans(pb as never, new Date('2026-06-01T00:01:00.000Z'))
    expect(create).toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith('site1', { verification_due_at: null })
  })
})
