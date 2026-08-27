import { describe, expect, it } from 'vitest'
import { buildContentExplorerSiteRows } from '~/utils/contentExplorerSites'
import type { Scan, Site } from '~/types/sitenook'

function site(partial: Partial<Site> & Pick<Site, 'id' | 'name' | 'url'>): Site {
  return {
    organization: 'org',
    created: '',
    updated: '',
    ...partial
  } as Site
}

function scan(partial: Partial<Scan> & Pick<Scan, 'id' | 'status'>): Scan {
  return {
    site: 's1',
    pages_crawled: 0,
    ...partial
  } as Scan
}

describe('contentExplorerSites', () => {
  it('builds site rows with page counts and last scan timestamps', () => {
    const rows = buildContentExplorerSiteRows(
      [
        site({ id: 'a', name: 'Alpha', url: 'https://a.example' }),
        site({ id: 'b', name: 'Beta', url: 'https://b.example' })
      ],
      {
        a: [scan({ id: 's1', status: 'complete', completed_at: '2024-05-01T00:00:00Z', pages_crawled: 24 })],
        b: []
      }
    )
    expect(rows).toEqual([
      {
        siteId: 'a',
        siteName: 'Alpha',
        siteUrl: 'https://a.example',
        pageCount: 24,
        lastScanAt: '2024-05-01T00:00:00Z'
      },
      {
        siteId: 'b',
        siteName: 'Beta',
        siteUrl: 'https://b.example',
        pageCount: 0,
        lastScanAt: null
      }
    ])
  })
})
