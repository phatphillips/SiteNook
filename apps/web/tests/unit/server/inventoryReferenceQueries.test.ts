import { describe, expect, it, vi } from 'vitest'
import { loadInventorySourcePages, resolveInventoryScanId } from '../../../server/utils/inventoryReferenceQueries'

describe('resolveInventoryScanId', () => {
  it('uses display scan selection instead of sorting by created', async () => {
    const getFullList = vi.fn().mockResolvedValue([
      { id: 'scan-old', status: 'complete', completed_at: '2026-01-01T00:00:00Z' },
      { id: 'scan-new', status: 'complete', completed_at: '2026-02-01T00:00:00Z' }
    ])

    const pb = {
      collection: () => ({ getFullList })
    } as never

    await expect(resolveInventoryScanId(pb, 'site1')).resolves.toBe('scan-new')
    expect(getFullList).toHaveBeenCalledWith({
      filter: expect.stringContaining('site = "site1"'),
      fields: 'id,site,status,completed_at,started_at,created'
    })
    expect(getFullList.mock.calls[0]?.[0]?.filter).not.toContain('-created')
  })
})

describe('loadInventorySourcePages', () => {
  it('returns pages for matching asset refs', async () => {
    const scansGetFullList = vi.fn().mockResolvedValue([
      { id: 'scan1', status: 'complete', completed_at: '2026-02-01T00:00:00Z' }
    ])
    const refsGetFullList = vi.fn().mockResolvedValue([
      { page: 'page1' },
      { page: 'page2' }
    ])
    const pagesGetFullList = vi.fn().mockResolvedValue([
      { id: 'page1', url: 'https://example.com/about', title: 'About us' },
      { id: 'page2', url: 'https://example.com/contact', title: 'Contact' }
    ])

    const pb = {
      collection(name: string) {
        if (name === 'scans') return { getFullList: scansGetFullList }
        if (name === 'qa_inventory_refs') return { getFullList: refsGetFullList }
        if (name === 'pages') return { getFullList: pagesGetFullList }
        throw new Error(`unexpected collection ${name}`)
      }
    } as never

    const pages = await loadInventorySourcePages(
      pb,
      'site1',
      'https://cdn.example.com/logo.png?v=1'
    )

    expect(pages).toEqual([
      { url: 'https://example.com/about', title: 'About us' },
      { url: 'https://example.com/contact', title: 'Contact' }
    ])
  })

  it('loads pages by id when refs exist', async () => {
    const scansGetFullList = vi.fn().mockResolvedValue([
      { id: 'scan1', status: 'complete', completed_at: '2026-02-01T00:00:00Z' }
    ])
    const refsGetFullList = vi.fn().mockResolvedValue([
      { page: 'page1' }
    ])
    const pagesGetFullList = vi.fn().mockResolvedValue([
      { id: 'page1', url: 'https://example.com/home', title: 'Home' }
    ])

    const pb = {
      collection(name: string) {
        if (name === 'scans') return { getFullList: scansGetFullList }
        if (name === 'qa_inventory_refs') return { getFullList: refsGetFullList }
        if (name === 'pages') return { getFullList: pagesGetFullList }
        throw new Error(`unexpected collection ${name}`)
      }
    } as never

    const pages = await loadInventorySourcePages(pb, 'site1', 'https://cdn.example.com/logo.png')
    expect(pages).toEqual([{ url: 'https://example.com/home', title: 'Home' }])
  })
})
