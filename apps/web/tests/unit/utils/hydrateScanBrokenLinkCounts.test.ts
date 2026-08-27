import { describe, expect, it, vi } from 'vitest'
import type { Scan } from '~/types/sitenook'
import { hydrateScanBrokenLinkCounts } from '~/utils/hydrateScanBrokenLinkCounts'

function scan(partial: Partial<Scan> & Pick<Scan, 'id'>): Scan {
  return {
    site: 'site1',
    status: 'complete',
    scan_type: 'full',
    pages_crawled: 1,
    ...partial
  }
}

describe('hydrateScanBrokenLinkCounts', () => {
  it('leaves scans with broken_link_count unchanged', async () => {
    const pb = {
      collection: vi.fn()
    }
    const scans = [scan({ id: 's1', broken_link_count: 4 })]
    const result = await hydrateScanBrokenLinkCounts(pb as never, scans)
    expect(result[0]!.broken_link_count).toBe(4)
    expect(pb.collection).not.toHaveBeenCalled()
  })

  it('fills missing counts from qa_broken_links totals', async () => {
    const getList = vi.fn().mockResolvedValue({ totalItems: 7 })
    const pb = {
      collection: vi.fn().mockReturnValue({ getList })
    }
    const scans = [scan({ id: 's1' }), scan({ id: 's2', broken_link_count: 2 })]
    const result = await hydrateScanBrokenLinkCounts(pb as never, scans)
    expect(result[0]!.broken_link_count).toBe(7)
    expect(result[1]!.broken_link_count).toBe(2)
    expect(getList).toHaveBeenCalledTimes(1)
    expect(getList.mock.calls[0]![2].filter).toContain('scan = "s1"')
  })
})
