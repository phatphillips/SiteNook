import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { ref } from 'vue'

const mockCollections: Record<string, { getFullList: ReturnType<typeof vi.fn>, subscribe: ReturnType<typeof vi.fn> }> = {}

let useQA: typeof import('~/composables/useQA').useQA

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

  const mod = await import('~/composables/useQA')
  useQA = mod.useQA
})

describe('useQA', () => {
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

  it('prefers running scan as latest data source', async () => {
    col('scans').getFullList.mockResolvedValue([
      { id: 'complete-1', site: 'site-1', status: 'complete', scan_type: 'full', pages_crawled: 10, completed_at: '2026-05-27T10:00:00Z' },
      { id: 'running-1', site: 'site-1', status: 'running', scan_type: 'full', pages_crawled: 2, started_at: '2026-05-28T10:00:00Z' }
    ])
    col('qa_broken_links').getFullList.mockResolvedValue([])
    col('qa_spelling').getFullList.mockResolvedValue([])
    col('pages').getFullList.mockResolvedValue([])
    col('qa_inventory').getFullList.mockResolvedValue([])

    const siteId = ref('site-1')
    const { latestScan, fetchQAData } = useQA(siteId)
    await fetchQAData()

    expect(latestScan.value?.id).toBe('running-1')
    expect(col('scans').getFullList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.stringContaining('site-1')
      })
    )
    expect(col('scans').getFullList.mock.calls[0]?.[0]).not.toHaveProperty('sort')
  })

  it('clears QA datasets when no eligible scans exist', async () => {
    col('scans').getFullList.mockResolvedValue([])
    col('qa_broken_links').getFullList.mockResolvedValue([{ id: 'stale' }])
    col('qa_spelling').getFullList.mockResolvedValue([{ id: 'stale' }])
    col('pages').getFullList.mockResolvedValue([{ id: 'stale' }])
    col('qa_inventory').getFullList.mockResolvedValue([{ id: 'stale' }])

    const siteId = ref('site-1')
    const { brokenLinks, spelling, pages, inventory, fetchQAData } = useQA(siteId)
    await fetchQAData()

    expect(brokenLinks.value).toEqual([])
    expect(spelling.value).toEqual([])
    expect(pages.value).toEqual([])
    expect(inventory.value).toEqual([])
  })

  it('debounces broken link subscription reloads to pages-only fetch', async () => {
    col('scans').getFullList.mockResolvedValue([
      { id: 'running-1', site: 'site-1', status: 'running', scan_type: 'full', pages_crawled: 1, started_at: '2026-06-01T00:00:00.000Z' }
    ])
    col('qa_broken_links').getFullList.mockResolvedValue([])
    col('qa_spelling').getFullList.mockResolvedValue([])
    col('pages').getFullList.mockResolvedValue([])
    col('qa_inventory').getFullList.mockResolvedValue([])

    const siteId = ref('site-1')
    useQA(siteId)
    await Promise.resolve()
    await Promise.resolve()

    const linksSubscribe = col('qa_broken_links').subscribe.mock.calls[0]?.[1] as ((e: unknown) => void) | undefined
    expect(linksSubscribe).toBeTypeOf('function')

    col('qa_broken_links').getFullList.mockClear()
    col('pages').getFullList.mockClear()
    col('qa_spelling').getFullList.mockClear()
    col('qa_inventory').getFullList.mockClear()

    linksSubscribe?.({ record: { scan: 'running-1' } })
    linksSubscribe?.({ record: { scan: 'running-1' } })

    expect(col('qa_broken_links').getFullList).not.toHaveBeenCalled()
    expect(col('pages').getFullList).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(400)

    expect(col('qa_broken_links').getFullList).toHaveBeenCalledTimes(1)
    expect(col('pages').getFullList).not.toHaveBeenCalled()
    expect(col('qa_spelling').getFullList).not.toHaveBeenCalled()
    expect(col('qa_inventory').getFullList).not.toHaveBeenCalled()
  })

  it('filters broken links by href substring', async () => {
    col('scans').getFullList.mockResolvedValue([
      { id: 'complete-1', site: 'site-1', status: 'complete', scan_type: 'full', pages_crawled: 10, completed_at: '2026-05-27T10:00:00Z' }
    ])
    col('qa_broken_links').getFullList.mockResolvedValue([])
    col('qa_spelling').getFullList.mockResolvedValue([])
    col('pages').getFullList.mockResolvedValue([])
    col('qa_inventory').getFullList.mockResolvedValue([])

    const siteId = ref('site-1')
    const { fetchQAData, fetchBrokenLinks } = useQA(siteId)
    await fetchQAData()
    col('qa_broken_links').getFullList.mockClear()

    await fetchBrokenLinks({ hrefQuery: 'decyp.tas.gov.au' })

    expect(col('qa_broken_links').getFullList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.stringContaining('href ~ \'decyp.tas.gov.au\'')
      })
    )
  })
})
