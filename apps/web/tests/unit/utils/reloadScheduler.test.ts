import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDebouncedReload } from '~/utils/reloadScheduler'

describe('createDebouncedReload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces multiple schedule calls into one run', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const { schedule } = createDebouncedReload(run, 300)

    schedule()
    schedule()
    schedule()

    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    await Promise.resolve()
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('queues one follow-up run while in flight', async () => {
    let resolveRun: (() => void) | undefined
    const run = vi.fn(() => new Promise<void>((resolve) => {
      resolveRun = resolve
    }))
    const { schedule, flush } = createDebouncedReload(run, 0)

    const first = flush()
    schedule()
    resolveRun?.()
    await first
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()

    expect(run).toHaveBeenCalledTimes(2)
  })
})
