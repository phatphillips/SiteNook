import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildScheduleFieldsAfterEnqueue,
  isSiteBusy,
  enqueueScheduledScan,
  pushOverdueScheduleForward,
  skipScheduledRunIfWithinMinGap
} from '../../../src/scheduler/scanScheduler.js'

function mockPb(overrides: {
  queueCount?: number
  runningCount?: number
  backgroundCount?: number
  createError?: boolean
  updateError?: boolean
  latestScan?: { started_at?: string, completed_at?: string, created?: string } | null
}) {
  const create = vi.fn().mockResolvedValue({ id: 'q1' })
  const update = vi.fn().mockResolvedValue({})
  if (overrides.createError) create.mockRejectedValue(new Error('create failed'))
  if (overrides.updateError) update.mockRejectedValue(new Error('update failed'))

  return {
    collection: vi.fn((name: string) => {
      if (name === 'scan_queue') {
        return {
          getList: vi.fn().mockResolvedValue({ items: Array(overrides.queueCount ?? 0).fill({}) }),
          create
        }
      }
      if (name === 'scans') {
        return {
          getList: vi.fn().mockImplementation((_page: number, _perPage: number, opts?: { filter?: string }) => {
            const filter = opts?.filter ?? ''
            if (filter.includes('status')) {
              const count = (overrides.backgroundCount ?? 0) + (overrides.runningCount ?? 0)
              return Promise.resolve({ items: Array(count).fill({}) })
            }
            if (overrides.latestScan) {
              return Promise.resolve({ items: [overrides.latestScan] })
            }
            return Promise.resolve({ items: [] })
          })
        }
      }
      if (name === 'sites') {
        return { update }
      }
      throw new Error(`unexpected collection ${name}`)
    }),
    _create: create,
    _update: update
  }
}

describe('isSiteBusy', () => {
  it('returns true when queue has pending item', async () => {
    const pb = mockPb({ queueCount: 1, runningCount: 0 }) as never
    await expect(isSiteBusy(pb, 'site1')).resolves.toBe(true)
  })

  it('returns true when a scan is running', async () => {
    const pb = mockPb({ queueCount: 0, runningCount: 1 }) as never
    await expect(isSiteBusy(pb, 'site1')).resolves.toBe(true)
  })

  it('returns true when a scan is in background_scan', async () => {
    const pb = mockPb({ queueCount: 0, runningCount: 0, backgroundCount: 1 }) as never
    await expect(isSiteBusy(pb, 'site1')).resolves.toBe(true)
  })

  it('returns false when site is idle', async () => {
    const pb = mockPb({ queueCount: 0, runningCount: 0 }) as never
    await expect(isSiteBusy(pb, 'site1')).resolves.toBe(false)
  })
})

describe('buildScheduleFieldsAfterEnqueue', () => {
  it('sets last enqueued and computes next run for hourly', () => {
    const enqueuedAt = new Date('2026-05-28T10:00:00.000Z')
    const fields = buildScheduleFieldsAfterEnqueue(
      { id: 's1', crawl_schedule: 'hourly', default_scan_config: {} },
      enqueuedAt
    )
    expect(fields.schedule_last_enqueued_at).toBe(enqueuedAt.toISOString())
    expect(fields.schedule_next_run_at).toBe('2026-05-28T11:00:00.000Z')
  })
})

describe('pushOverdueScheduleForward', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rolls schedule forward without enqueue when overdue and idle', async () => {
    const pb = mockPb({ queueCount: 0, runningCount: 0 }) as never
    const result = await pushOverdueScheduleForward(
      pb,
      {
        id: 'site1',
        crawl_schedule: 'daily',
        schedule_next_run_at: '2026-05-27T12:00:00.000Z',
        default_scan_config: { mode: 'full', schedule: { time: '14:00' } }
      },
      new Date('2026-05-28T12:00:00.000Z')
    )
    expect(result.schedule_next_run_at).toBeTruthy()
    expect(result.schedule_next_run_at).not.toBe('2026-05-27T12:00:00.000Z')
    const pbMock = pb as { _create: ReturnType<typeof vi.fn>, _update: ReturnType<typeof vi.fn> }
    expect(pbMock._create).not.toHaveBeenCalled()
    expect(pbMock._update).toHaveBeenCalled()
  })

  it('does nothing when site already has queue work', async () => {
    const pb = mockPb({ queueCount: 1, runningCount: 0 }) as never
    const site = {
      id: 'site1',
      crawl_schedule: 'daily',
      schedule_next_run_at: '2026-05-27T12:00:00.000Z',
      default_scan_config: {}
    }
    const result = await pushOverdueScheduleForward(pb, site, new Date('2026-05-28T12:00:00.000Z'))
    expect(result.schedule_next_run_at).toBe('2026-05-27T12:00:00.000Z')
    const pbMock = pb as { _update: ReturnType<typeof vi.fn> }
    expect(pbMock._update).not.toHaveBeenCalled()
  })
})

describe('enqueueScheduledScan', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates queue row and updates site schedule fields', async () => {
    const pb = mockPb({}) as never
    const ok = await enqueueScheduledScan(
      pb,
      {
        id: 'site1',
        crawl_schedule: 'hourly',
        default_scan_config: { mode: 'full', schedule: { time: '02:00' } }
      }
    )
    expect(ok).toBe(true)
    const pbMock = pb as { _create: ReturnType<typeof vi.fn>, _update: ReturnType<typeof vi.fn> }
    expect(pbMock._create).toHaveBeenCalledWith(
      expect.objectContaining({
        site: 'site1',
        status: 'pending',
        raw_config: { mode: 'full' }
      })
    )
    expect(pbMock._update).toHaveBeenCalledWith(
      'site1',
      expect.objectContaining({
        schedule_last_enqueued_at: '2026-05-28T10:00:00.000Z',
        schedule_next_run_at: '2026-05-28T11:00:00.000Z'
      })
    )
  })

  it('does not advance schedule when enqueue fails', async () => {
    const pb = mockPb({ createError: true }) as never
    const ok = await enqueueScheduledScan(pb, {
      id: 'site1',
      crawl_schedule: 'daily',
      default_scan_config: {}
    })
    expect(ok).toBe(false)
    const pbMock = pb as { _update: ReturnType<typeof vi.fn> }
    expect(pbMock._update).not.toHaveBeenCalled()
  })

  it('keeps scheduled enqueue successful even when schedule update fails', async () => {
    vi.useRealTimers()
    const pb = mockPb({ updateError: true }) as never
    const ok = await enqueueScheduledScan(pb, {
      id: 'site1',
      crawl_schedule: 'daily',
      default_scan_config: { mode: 'full' }
    })
    expect(ok).toBe(true)
    const pbMock = pb as { _create: ReturnType<typeof vi.fn>, _update: ReturnType<typeof vi.fn> }
    expect(pbMock._create).toHaveBeenCalledTimes(1)
    expect(pbMock._update).toHaveBeenCalledTimes(3)
  })
})

describe('skipScheduledRunIfWithinMinGap', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rolls schedule forward when last scan activity was within the gap window', async () => {
    const pb = mockPb({
      latestScan: { started_at: '2026-05-28T11:30:00.000Z' }
    }) as never
    const site = {
      id: 'site1',
      crawl_schedule: 'every_5d',
      schedule_next_run_at: '2026-05-28T10:00:00.000Z',
      default_scan_config: {}
    }
    const result = await skipScheduledRunIfWithinMinGap(
      pb,
      site,
      new Date('2026-05-28T12:00:00.000Z')
    )
    expect(result.schedule_next_run_at).toBe('2026-05-28T12:30:00.000Z')
    const pbMock = pb as { _update: ReturnType<typeof vi.fn> }
    expect(pbMock._update).toHaveBeenCalled()
  })

  it('does nothing when last scan activity is outside the gap window', async () => {
    const pb = mockPb({
      latestScan: { completed_at: '2026-05-28T09:00:00.000Z' }
    }) as never
    const site = {
      id: 'site1',
      crawl_schedule: 'every_5d',
      schedule_next_run_at: '2026-05-28T10:00:00.000Z',
      default_scan_config: {}
    }
    const result = await skipScheduledRunIfWithinMinGap(
      pb,
      site,
      new Date('2026-05-28T12:00:00.000Z')
    )
    expect(result.schedule_next_run_at).toBe('2026-05-28T10:00:00.000Z')
    const pbMock = pb as { _update: ReturnType<typeof vi.fn> }
    expect(pbMock._update).not.toHaveBeenCalled()
  })
})
