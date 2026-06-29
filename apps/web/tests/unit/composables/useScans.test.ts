import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ref } from 'vue'
import {
  buildActiveQueueFilter,
  buildActiveScansFilter,
  buildHistoryFilter,
  buildSiteFilterClause
} from '~/composables/useScans'

const mockGetFullList = vi.fn()
const mockGetList = vi.fn()
const mockGetOne = vi.fn()
const mockDelete = vi.fn()
const mockSubscribe = vi.fn()

let useScans: typeof import('~/composables/useScans').useScans

beforeAll(async () => {
  vi.stubGlobal('usePocketBase', () => ({
    pb: {
      collection: () => ({
        getFullList: mockGetFullList,
        getList: mockGetList,
        getOne: mockGetOne,
        delete: mockDelete,
        subscribe: mockSubscribe
      })
    },
    awaitAuthReady: vi.fn().mockResolvedValue(undefined),
    syncAuth: vi.fn()
  }))

  vi.stubGlobal('useSites', () => ({
    sites: ref([]),
    fetchSites: vi.fn().mockResolvedValue(undefined)
  }))

  const stateMap = new Map<string, ReturnType<typeof ref>>()
  vi.stubGlobal('useState', (key: string, init?: () => unknown) => {
    if (!stateMap.has(key)) {
      stateMap.set(key, ref(init?.()))
    }
    return stateMap.get(key)!
  })

  mockSubscribe.mockResolvedValue(() => {})

  const mod = await import('~/composables/useScans')
  useScans = mod.useScans
})

describe('scan filter builders', () => {
  it('buildSiteFilterClause returns empty when no site', () => {
    expect(buildSiteFilterClause(null)).toBe('')
    expect(buildSiteFilterClause(undefined)).toBe('')
  })

  it('buildSiteFilterClause scopes by site id', () => {
    expect(buildSiteFilterClause('site-abc')).toBe(' && site = "site-abc"')
  })

  it('buildHistoryFilter includes status and site', () => {
    expect(buildHistoryFilter(null, 'all')).toBe(
      "(status = 'complete' || status = 'complete_with_errors' || status = 'failed' || status = 'cancelled')"
    )
    expect(buildHistoryFilter('site-1', 'complete')).toBe(
      "(status = 'complete' || status = 'complete_with_errors') && site = \"site-1\""
    )
    expect(buildHistoryFilter('site-1', 'failed')).toBe(
      "(status = 'failed' || status = 'cancelled') && site = \"site-1\""
    )
  })

  it('buildActiveQueueFilter targets pending and processing', () => {
    expect(buildActiveQueueFilter(null)).toBe(
      "(status = 'pending' || status = 'processing')"
    )
    expect(buildActiveScansFilter('site-2')).toBe(
      "(status = 'running' || status = 'background_scan') && site = \"site-2\""
    )
  })
})

describe('useScans', () => {
  beforeEach(() => {
    mockGetFullList.mockReset()
    mockGetList.mockReset()
    mockGetOne.mockReset()
    mockDelete.mockReset()
    mockGetFullList.mockResolvedValue([])
    mockGetList.mockResolvedValue({ items: [], totalItems: 0 })
    mockDelete.mockResolvedValue(undefined)
  })

  it('openRescan sets modal state from scan raw_config', async () => {
    const { openRescan, rescanSite, rescanRawConfig, rescanModalOpen } = useScans()

    const scan = {
      id: 'scan-1',
      site: 'site-1',
      status: 'complete' as const,
      scan_type: 'full',
      pages_crawled: 10,
      raw_config: { mode: 'pages', pages: ['https://example.com/a'] },
      expand: {
        site: { id: 'site-1', name: 'Example', url: 'https://example.com' }
      }
    }

    const ok = await openRescan(scan)
    expect(ok).toBe(true)
    expect(rescanModalOpen.value).toBe(true)
    expect(rescanSite.value?.id).toBe('site-1')
    expect(rescanRawConfig.value).toEqual({ mode: 'pages', pages: ['https://example.com/a'] })
  })

  it('fetchHistory uses paginated getList with history filter', async () => {
    mockGetList.mockResolvedValue({
      items: [{ id: 's1', site: 'site-1', status: 'complete', scan_type: 'full', pages_crawled: 5 }],
      totalItems: 1
    })

    const { fetchHistory, historyScans, historyTotal } = useScans()
    await fetchHistory()

    expect(mockGetList).toHaveBeenCalledWith(
      1,
      20,
      expect.objectContaining({
        filter: "(status = 'complete' || status = 'complete_with_errors' || status = 'failed' || status = 'cancelled')",
        expand: 'site'
      })
    )
    expect(historyScans.value).toHaveLength(1)
    expect(historyTotal.value).toBe(1)
  })

  it('fetchHistory retries without sort when sorted query fails', async () => {
    mockGetList
      .mockRejectedValueOnce(new Error('Invalid sort field'))
      .mockResolvedValueOnce({
        items: [{ id: 's2', site: 'site-2', status: 'failed', scan_type: 'full', pages_crawled: 1 }],
        totalItems: 1
      })

    const { fetchHistory, historyScans, historyTotal } = useScans()
    await fetchHistory()

    expect(mockGetList).toHaveBeenNthCalledWith(
      1,
      1,
      20,
      expect.objectContaining({
        sort: '-started_at'
      })
    )
    expect(mockGetList).toHaveBeenNthCalledWith(
      2,
      1,
      20,
      expect.not.objectContaining({
        sort: '-started_at'
      })
    )
    expect(historyScans.value).toHaveLength(1)
    expect(historyTotal.value).toBe(1)
  })

  it('loadScansForSite performs client-side sorting without server sort', async () => {
    mockGetList.mockResolvedValueOnce({
      items: [
        { id: 'old', site: 'site-1', status: 'complete', scan_type: 'full', started_at: '2025-01-01T00:00:00.000Z' },
        { id: 'new', site: 'site-1', status: 'complete', scan_type: 'full', started_at: '2025-01-02T00:00:00.000Z' }
      ],
      totalItems: 2
    })

    const { loadScansForSite } = useScans()
    const scans = await loadScansForSite('site-1')

    expect(mockGetList).toHaveBeenCalledWith(
      1,
      50,
      expect.not.objectContaining({
        sort: '-started_at'
      })
    )
    expect(scans.map(scan => scan.id)).toEqual(['new', 'old'])
  })

  it('fetchLatestScansSummary keeps previous map on fetch error', async () => {
    mockGetList
      .mockResolvedValueOnce({
        items: [
          { id: 'latest', site: 'site-1', status: 'complete', scan_type: 'full', started_at: '2025-01-03T00:00:00.000Z' }
        ],
        totalItems: 1
      })
      .mockRejectedValueOnce(new Error('Network error'))

    const { fetchLatestScansSummary, latestScanBySiteId, error } = useScans()
    await fetchLatestScansSummary()
    expect(latestScanBySiteId.value.get('site-1')?.id).toBe('latest')

    await fetchLatestScansSummary()
    expect(latestScanBySiteId.value.get('site-1')?.id).toBe('latest')
    expect(error.value).toContain('Network error')
  })

  it('activeRows sorts safely when queue items lack created timestamps', async () => {
    mockGetList
      .mockResolvedValueOnce({
        items: [{ id: 'q1', site: 'site-1', status: 'pending' }],
        totalItems: 1
      })
      .mockResolvedValueOnce({
        items: [{ id: 's1', site: 'site-2', status: 'running', scan_type: 'full' }],
        totalItems: 1
      })

    const { fetchActive, activeRows } = useScans()
    await fetchActive()

    expect(activeRows.value).toHaveLength(2)
    expect(() => activeRows.value.map(r => r.timestamp)).not.toThrow()
  })

  it('activeRows hides processing queue row when same site has running scan', async () => {
    mockGetList
      .mockResolvedValueOnce({
        items: [{ id: 'q1', site: 'site-1', status: 'processing', created: '2025-01-02' }],
        totalItems: 1
      })
      .mockResolvedValueOnce({
        items: [{
          id: 's1',
          site: 'site-1',
          status: 'running',
          scan_type: 'full',
          pages_crawled: 3,
          started_at: '2025-01-02'
        }],
        totalItems: 1
      })

    const { fetchActive, activeRows } = useScans()
    await fetchActive()

    expect(activeRows.value).toHaveLength(1)
    expect(activeRows.value[0]?.source).toBe('scan')
    expect(activeRows.value[0]?.status).toBe('running')
  })

  it('isSiteBusy is true when queue has pending item for site', async () => {
    mockGetList
      .mockResolvedValueOnce({
        items: [{ id: 'q1', site: 'site-1', status: 'pending', created: '2025-01-01' }],
        totalItems: 1
      })
      .mockResolvedValueOnce({ items: [], totalItems: 0 })

    const { fetchActive, isSiteBusy } = useScans()
    await fetchActive()

    expect(isSiteBusy('site-1')).toBe(true)
    expect(isSiteBusy('site-2')).toBe(false)
  })

  it('refreshAll preserves scansBySite until reload completes', async () => {
    const siteId = 'site-refresh-all-test'
    const cachedScan = {
      id: 'scan-a',
      site: siteId,
      status: 'complete' as const,
      scan_type: 'full',
      started_at: '2025-01-02T00:00:00.000Z'
    }

    mockGetList.mockImplementation((page: number, perPage: number, opts?: { filter?: string }) => {
      if (opts?.filter?.includes(siteId)) {
        return Promise.resolve({ items: [cachedScan], totalItems: 1 })
      }
      return Promise.resolve({ items: [], totalItems: 0 })
    })
    mockGetFullList.mockResolvedValue([])

    const { loadScansForSite, refreshAll, scansBySite } = useScans()
    await loadScansForSite(siteId)
    expect(scansBySite.value.get(siteId)).toHaveLength(1)

    const refreshPromise = refreshAll()
    expect(scansBySite.value.get(siteId)).toHaveLength(1)
    await refreshPromise
    expect(scansBySite.value.get(siteId)).toHaveLength(1)
  })

  it('refreshSiteScansIfLoaded refetches without clearing cache first', async () => {
    const siteId = 'site-reload-test'
    const initial = {
      id: 'scan-old',
      site: siteId,
      status: 'complete' as const,
      scan_type: 'full',
      started_at: '2025-01-01T00:00:00.000Z'
    }
    const updated = {
      id: 'scan-new',
      site: siteId,
      status: 'running' as const,
      scan_type: 'full',
      started_at: '2025-01-03T00:00:00.000Z'
    }

    let siteListCalls = 0
    mockGetList.mockImplementation((page: number, perPage: number, opts?: { filter?: string }) => {
      if (!opts?.filter?.includes(siteId)) {
        return Promise.resolve({ items: [], totalItems: 0 })
      }
      siteListCalls += 1
      if (siteListCalls === 1) {
        return Promise.resolve({ items: [initial], totalItems: 1 })
      }
      return Promise.resolve({ items: [initial, updated], totalItems: 2 })
    })

    const { loadScansForSite, refreshSiteScansIfLoaded, scansBySite } = useScans()
    await loadScansForSite(siteId)
    expect(scansBySite.value.get(siteId)?.map(s => s.id)).toEqual(['scan-old'])

    const reload = refreshSiteScansIfLoaded(siteId)
    expect(scansBySite.value.get(siteId)?.map(s => s.id)).toEqual(['scan-old'])

    await reload
    expect(scansBySite.value.get(siteId)?.map(s => s.id)).toEqual(['scan-new', 'scan-old'])
  })

  it('refreshSiteScansIfLoaded is a no-op when site history was never loaded', async () => {
    const { refreshSiteScansIfLoaded } = useScans()
    const callsBefore = mockGetList.mock.calls.length
    await refreshSiteScansIfLoaded('site-never-loaded-xyz')
    expect(mockGetList.mock.calls.length).toBe(callsBefore)
  })

  it('deleteScan refreshes site history when siteId is provided', async () => {
    const siteId = 'site-delete-test'
    const scan = {
      id: 'scan-del-1',
      site: siteId,
      status: 'complete' as const,
      scan_type: 'full',
      started_at: '2025-01-01T00:00:00.000Z'
    }

    let siteListCalls = 0
    mockGetList.mockImplementation((page: number, perPage: number, opts?: { filter?: string }) => {
      if (!opts?.filter?.includes(siteId)) {
        return Promise.resolve({ items: [], totalItems: 0 })
      }
      siteListCalls += 1
      if (siteListCalls === 1) {
        return Promise.resolve({ items: [scan], totalItems: 1 })
      }
      return Promise.resolve({ items: [], totalItems: 0 })
    })

    const { loadScansForSite, deleteScan } = useScans()
    await loadScansForSite(siteId)
    mockGetList.mockClear()
    mockGetList.mockImplementation((page: number, perPage: number, opts?: { filter?: string }) => {
      if (opts?.filter?.includes(siteId)) {
        return Promise.resolve({ items: [], totalItems: 0 })
      }
      return Promise.resolve({ items: [], totalItems: 0 })
    })

    await deleteScan('scan-del-1', siteId)

    expect(mockDelete).toHaveBeenCalledWith('scan-del-1')
    expect(mockGetList).toHaveBeenCalledWith(
      1,
      50,
      expect.objectContaining({
        filter: expect.stringContaining(siteId)
      })
    )
  })
})
