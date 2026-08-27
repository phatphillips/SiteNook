import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { ref } from 'vue'

const mockCollections: Record<string, {
  getFullList: ReturnType<typeof vi.fn>
  getList: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
}> = {}

let useQA: typeof import('~/composables/useQA').useQA

function col(name: string) {
  if (!mockCollections[name]) {
    mockCollections[name] = {
      getFullList: vi.fn(),
      getList: vi.fn().mockResolvedValue({ totalItems: 0, items: [] }),
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
      m.getList.mockReset()
      m.getList.mockResolvedValue({ totalItems: 0, items: [] })
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
    col('qa_broken_links').getList.mockResolvedValue({ totalItems: 3, items: [{}] })
    col('qa_spelling').getList.mockResolvedValue({ totalItems: 1, items: [{}] })
    col('pages').getList.mockResolvedValue({ totalItems: 0, items: [] })

    const siteId = ref('site-1')
    const { latestScan, brokenLinkCount, fetchQAData } = useQA(siteId)
    await fetchQAData()

    expect(latestScan.value?.id).toBe('running-1')
    expect(brokenLinkCount.value).toBe(3)
    expect(col('qa_broken_links').getFullList).not.toHaveBeenCalled()
    expect(col('qa_inventory').getFullList).not.toHaveBeenCalled()
    expect(col('scans').getFullList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.stringContaining('site-1')
      })
    )
  })

  it('clears QA datasets when no eligible scans exist', async () => {
    col('scans').getFullList.mockResolvedValue([])

    const siteId = ref('site-1')
    const {
      brokenLinks,
      spelling,
      policyMatches,
      pages,
      inventory,
      brokenLinkCount,
      policyMatchCount,
      fetchQAData
    } = useQA(siteId)
    await fetchQAData()

    expect(brokenLinks.value).toEqual([])
    expect(spelling.value).toEqual([])
    expect(policyMatches.value).toEqual([])
    expect(pages.value).toEqual([])
    expect(inventory.value).toEqual([])
    expect(brokenLinkCount.value).toBe(0)
    expect(policyMatchCount.value).toBe(0)
  })

  it('loads full broken links only in non-summary mode', async () => {
    col('scans').getFullList.mockResolvedValue([
      { id: 'complete-1', site: 'site-1', status: 'complete', scan_type: 'full', pages_crawled: 10, completed_at: '2026-05-27T10:00:00Z' }
    ])
    col('qa_broken_links').getList.mockResolvedValue({ totalItems: 0, items: [] })
    col('qa_broken_links').getFullList.mockResolvedValue([{ id: 'link-1', status: 'broken' }])
    col('qa_spelling').getFullList.mockResolvedValue([])
    col('pages').getFullList.mockResolvedValue([])

    const siteId = ref('site-1')
    const { brokenLinks, fetchQAData } = useQA(siteId, { summary: false, parts: ['links'] })
    await fetchQAData()

    expect(col('qa_broken_links').getFullList).toHaveBeenCalled()
    expect(brokenLinks.value).toHaveLength(1)
  })

  it('debounces broken link subscription reloads to links-only fetch', async () => {
    col('scans').getFullList.mockResolvedValue([
      { id: 'running-1', site: 'site-1', status: 'running', scan_type: 'full', pages_crawled: 1, started_at: '2026-06-01T00:00:00.000Z' }
    ])
    col('qa_broken_links').getList.mockResolvedValue({ totalItems: 0, items: [] })
    col('qa_broken_links').getFullList.mockResolvedValue([])
    col('qa_spelling').getFullList.mockResolvedValue([])
    col('pages').getFullList.mockResolvedValue([])

    const siteId = ref('site-1')
    const { fetchQAData } = useQA(siteId, { summary: false, parts: ['links'] })
    await fetchQAData()

    const linksSubscribe = col('qa_broken_links').subscribe.mock.calls[0]?.[1] as ((e: unknown) => void) | undefined
    expect(linksSubscribe).toBeTypeOf('function')

    col('qa_broken_links').getFullList.mockClear()
    col('pages').getFullList.mockClear()
    col('qa_spelling').getFullList.mockClear()

    linksSubscribe?.({ record: { scan: 'running-1' } })
    linksSubscribe?.({ record: { scan: 'running-1' } })

    expect(col('qa_broken_links').getFullList).not.toHaveBeenCalled()
    expect(col('pages').getFullList).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(400)

    expect(col('qa_broken_links').getFullList).toHaveBeenCalledTimes(1)
    expect(col('pages').getFullList).not.toHaveBeenCalled()
    expect(col('qa_spelling').getFullList).not.toHaveBeenCalled()
  })

  it('filters broken links by href substring', async () => {
    col('scans').getFullList.mockResolvedValue([
      { id: 'complete-1', site: 'site-1', status: 'complete', scan_type: 'full', pages_crawled: 10, completed_at: '2026-05-27T10:00:00Z' }
    ])
    col('qa_broken_links').getList.mockResolvedValue({ totalItems: 0, items: [] })
    col('qa_broken_links').getFullList.mockResolvedValue([])

    const siteId = ref('site-1')
    const { fetchQAData, fetchBrokenLinks } = useQA(siteId, { summary: false, parts: ['links'] })
    await fetchQAData()
    col('qa_broken_links').getFullList.mockClear()

    await fetchBrokenLinks({ hrefQuery: 'decyp.tas.gov.au' })

    expect(col('qa_broken_links').getFullList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.stringContaining('href ~ \'decyp.tas.gov.au\'')
      })
    )
  })

  it('loads policy matches in non-summary mode and counts open matches in summary', async () => {
    col('scans').getFullList.mockResolvedValue([
      { id: 'complete-1', site: 'site-1', status: 'complete', scan_type: 'full', pages_crawled: 10, completed_at: '2026-05-27T10:00:00Z' }
    ])
    col('qa_broken_links').getList.mockResolvedValue({ totalItems: 0, items: [] })
    col('qa_spelling').getList.mockResolvedValue({ totalItems: 0, items: [] })
    col('policy_matches').getList.mockResolvedValue({ totalItems: 4, items: [{}] })
    col('pages').getList.mockResolvedValue({ totalItems: 0, items: [] })

    const siteId = ref('site-1')
    const summary = useQA(siteId)
    await summary.fetchQAData()
    expect(summary.policyMatchCount.value).toBe(4)

    col('policy_matches').getFullList.mockResolvedValue([
      { id: 'm1', status: 'open', matched_text: 'x' },
      { id: 'm2', status: 'dismissed', matched_text: 'y' }
    ])
    const detail = useQA(siteId, { summary: false, parts: ['policies'] })
    await detail.fetchQAData()
    expect(col('policy_matches').getFullList).toHaveBeenCalled()
    expect(detail.policyMatches.value).toHaveLength(2)
    expect(detail.policyMatchCount.value).toBe(1)
  })
})
