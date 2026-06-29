import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

const mockGetList = vi.fn()
const mockSubscribe = vi.fn()

let useScanQueueStatus: typeof import('~/composables/useScanQueue').useScanQueueStatus

beforeAll(async () => {
  vi.stubGlobal('usePocketBase', () => ({
    pb: {
      collection: () => ({
        getList: mockGetList,
        subscribe: mockSubscribe
      })
    }
  }))

  const mod = await import('~/composables/useScanQueue')
  useScanQueueStatus = mod.useScanQueueStatus
})

describe('useScanQueueStatus', () => {
  let latestQueueHandler: ((e: { action: string, record: { site?: string, status?: string } }) => Promise<void>) | null
  let latestScanHandler: ((e: { action: string, record: { site?: string, status?: string } }) => Promise<void>) | null

  beforeEach(() => {
    mockGetList.mockReset()
    mockSubscribe.mockReset()
    latestQueueHandler = null
    latestScanHandler = null
    mockSubscribe.mockImplementation((topic: string, handler: unknown) => {
      if (!latestQueueHandler) {
        latestQueueHandler = handler as typeof latestQueueHandler
      } else {
        latestScanHandler = handler as typeof latestScanHandler
      }
      return Promise.resolve(() => {})
    })
  })

  it('isQueued returns true when a pending queue item exists', async () => {
    mockGetList.mockResolvedValue({ items: [{ id: 'q1', status: 'pending' }] })

    const siteId = ref('site-1')
    const { isQueued, isBusy, refresh } = useScanQueueStatus(siteId)

    await refresh()

    expect(isQueued.value).toBe(true)
    expect(isBusy.value).toBe(true)
    expect(mockGetList).toHaveBeenCalled()
  })

  it('refresh triggers a data reload', async () => {
    const siteId = ref<string | undefined>(undefined)
    const { isQueued, refresh } = useScanQueueStatus(siteId)
    await flushPromises()

    mockGetList
      .mockResolvedValueOnce({ items: [{ id: 'q1', status: 'pending' }] })
      .mockResolvedValueOnce({ items: [] })
    siteId.value = 'site-1'
    await flushPromises()
    expect(isQueued.value).toBe(true)

    mockGetList.mockResolvedValue({ items: [] })
    await refresh()
    expect(isQueued.value).toBe(false)
    expect(mockGetList.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('clears queued state when site id is unset', async () => {
    mockGetList.mockResolvedValue({ items: [{ id: 'q1', status: 'pending' }] })

    const siteId = ref<string | undefined>('site-1')
    const { isQueued, refresh } = useScanQueueStatus(siteId)

    await refresh()
    expect(isQueued.value).toBe(true)

    siteId.value = undefined
    await refresh()

    expect(isQueued.value).toBe(false)
  })

  it('refreshes on queue delete event to avoid stale queued state', async () => {
    mockGetList
      .mockResolvedValueOnce({ items: [{ id: 'q1', status: 'pending' }] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })

    const siteId = ref('site-1')
    const { isQueued } = useScanQueueStatus(siteId)
    await flushPromises()
    expect(isQueued.value).toBe(true)

    await latestQueueHandler?.({ action: 'delete', record: { site: 'site-1', status: 'pending' } })
    await flushPromises()
    expect(isQueued.value).toBe(false)
  })
})
