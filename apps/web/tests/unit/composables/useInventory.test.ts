import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { ref } from 'vue'

const mockCollections: Record<string, {
  getFullList: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
}> = {}

let useInventory: typeof import('~/composables/useInventory').useInventory

function col(name: string) {
  if (!mockCollections[name]) {
    mockCollections[name] = {
      getFullList: vi.fn(),
      subscribe: vi.fn().mockResolvedValue(() => {})
    }
  }
  return mockCollections[name]
}

beforeAll(async () => {
  vi.stubGlobal('usePocketBase', () => ({
    pb: {
      collection: (name: string) => col(name)
    }
  }))

  const mod = await import('~/composables/useInventory')
  useInventory = mod.useInventory
})

describe('useInventory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.values(mockCollections).forEach((m) => {
      m.getFullList.mockReset()
      m.subscribe.mockReset()
      m.subscribe.mockResolvedValue(() => {})
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads site pages and merges running scan with baseline', async () => {
    col('scans').getFullList.mockResolvedValue([
      { id: 'complete-1', site: 'site-1', status: 'complete', scan_type: 'full', completed_at: '2026-05-01T00:00:00.000Z' },
      { id: 'running-1', site: 'site-1', status: 'running', scan_type: 'full', pages_crawled: 2, started_at: '2026-06-01T00:00:00.000Z' }
    ])
    col('pages').getFullList.mockResolvedValue([
      { id: 'p1', url: 'https://example.com/old', site: 'site-1', scan: 'complete-1', created: '2026-05-01T00:00:00.000Z' },
      { id: 'p2', url: 'https://example.com/new', site: 'site-1', scan: 'running-1', created: '2026-06-01T00:00:00.000Z' }
    ])
    col('qa_inventory').getFullList.mockResolvedValue([{ id: 'i1', url: 'https://example.com/file.pdf' }])

    const siteId = ref('site-1')
    const { inventoryPages, latestScan, runningScan, inventory, fetchInventoryData } = useInventory(siteId)
    await fetchInventoryData()

    expect(latestScan.value?.id).toBe('running-1')
    expect(runningScan.value?.id).toBe('running-1')
    expect(inventoryPages.value).toHaveLength(2)
    expect(inventoryPages.value.find(p => p.url.endsWith('/new'))?.inventoryBadge).toBe('new')
    expect(inventoryPages.value.find(p => p.url.endsWith('/old'))?.inventoryBadge).toBe('pending')
    expect(inventory.value).toHaveLength(1)
  })

  it('debounces page subscription reloads', async () => {
    col('scans').getFullList.mockResolvedValue([
      { id: 'running-1', site: 'site-1', status: 'running', scan_type: 'full', pages_crawled: 1, started_at: '2026-06-01T00:00:00.000Z' }
    ])
    col('pages').getFullList.mockResolvedValue([])
    col('qa_inventory').getFullList.mockResolvedValue([])

    const siteId = ref('site-1')
    useInventory(siteId)
    await Promise.resolve()
    await Promise.resolve()

    const pagesSubscribe = col('pages').subscribe.mock.calls[0]?.[1] as ((e: unknown) => void) | undefined
    expect(pagesSubscribe).toBeTypeOf('function')

    col('pages').getFullList.mockClear()
    col('scans').getFullList.mockClear()
    pagesSubscribe?.({ record: { site: 'site-1', scan: 'running-1' } })
    pagesSubscribe?.({ record: { site: 'site-1', scan: 'running-1' } })
    pagesSubscribe?.({ record: { site: 'site-1', scan: 'running-1' } })

    expect(col('pages').getFullList).not.toHaveBeenCalled()
    expect(col('scans').getFullList).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(400)
    expect(col('pages').getFullList).toHaveBeenCalledTimes(1)
    expect(col('scans').getFullList).not.toHaveBeenCalled()
  })
})
