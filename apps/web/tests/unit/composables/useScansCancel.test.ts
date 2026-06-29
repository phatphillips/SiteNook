import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ref } from 'vue'

const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockGetFullList = vi.fn().mockResolvedValue([])

let useScans: typeof import('~/composables/useScans').useScans

beforeAll(async () => {
  vi.stubGlobal('usePocketBase', () => ({
    pb: {
      collection: () => ({
        update: mockUpdate,
        delete: mockDelete,
        getFullList: mockGetFullList,
        getList: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
        getOne: vi.fn(),
        subscribe: vi.fn().mockResolvedValue(() => {})
      })
    },
    awaitAuthReady: vi.fn().mockResolvedValue(undefined),
    syncAuth: vi.fn()
  }))

  vi.stubGlobal('useSites', () => ({
    sites: ref([]),
    fetchSites: vi.fn(),
    queueScanWithConfig: vi.fn()
  }))

  const stateMap = new Map<string, ReturnType<typeof ref>>()
  vi.stubGlobal('useState', (key: string, init?: () => unknown) => {
    if (!stateMap.has(key)) {
      stateMap.set(key, ref(init?.()))
    }
    return stateMap.get(key)!
  })

  const mod = await import('~/composables/useScans')
  useScans = mod.useScans
})

describe('cancelActiveScan', () => {
  beforeEach(() => {
    mockUpdate.mockReset()
    mockDelete.mockReset()
    mockUpdate.mockResolvedValue({})
    mockDelete.mockResolvedValue(true)
  })

  it('deletes pending queue item when cancelled status is rejected', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Failed to update'))

    const { cancelActiveScan } = useScans()
    await cancelActiveScan({
      id: 'queue-q1',
      recordId: 'q1',
      siteId: 'site-1',
      siteName: 'Test',
      scanType: 'full',
      status: 'pending',
      source: 'queue',
      timestamp: ''
    })

    expect(mockDelete).toHaveBeenCalledWith('q1')
  })

  it('cancels running scan record', async () => {
    const { cancelActiveScan } = useScans()
    await cancelActiveScan({
      id: 'scan-s1',
      recordId: 's1',
      siteId: 'site-1',
      siteName: 'Test',
      scanType: 'full',
      status: 'running',
      source: 'scan',
      timestamp: ''
    })

    expect(mockUpdate).toHaveBeenCalledWith('s1', expect.objectContaining({ status: 'cancelled' }))
  })

  it('cancels background_scan record and clears background_retry', async () => {
    const { cancelActiveScan } = useScans()
    await cancelActiveScan({
      id: 'scan-s2',
      recordId: 's2',
      siteId: 'site-1',
      siteName: 'Test',
      scanType: 'full',
      status: 'background_scan',
      source: 'scan',
      timestamp: ''
    })

    expect(mockUpdate).toHaveBeenCalledWith(
      's2',
      expect.objectContaining({
        status: 'cancelled',
        background_retry: null
      })
    )
  })
})
