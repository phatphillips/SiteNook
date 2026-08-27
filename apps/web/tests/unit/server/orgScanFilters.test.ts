import { describe, expect, it } from 'vitest'
import {
  attachSiteFromScan,
  buildLatestScansFilter,
  emptyOrgList,
  latestScanIds,
  scanSiteLookup
} from '../../../server/utils/orgScanFilters'
import type { ResolvedOrgSite } from '../../../server/utils/orgSites'

const sites: ResolvedOrgSite[] = [
  {
    siteId: 'site-a',
    name: 'Site A',
    url: 'https://a.test',
    latestScanId: 'scan-a',
    latestScan: null
  },
  {
    siteId: 'site-b',
    name: 'Site B',
    url: 'https://b.test',
    latestScanId: null,
    latestScan: null
  }
]

describe('orgScanFilters', () => {
  it('latestScanIds returns only sites with scans', () => {
    expect(latestScanIds(sites)).toEqual(['scan-a'])
  })

  it('buildLatestScansFilter builds OR scan filter', () => {
    expect(buildLatestScansFilter(sites)).toBe('(scan = "scan-a")')
    expect(buildLatestScansFilter([sites[1]])).toBeNull()
  })

  it('scanSiteLookup maps scan ids to sites', () => {
    const lookup = scanSiteLookup(sites)
    expect(lookup.get('scan-a')?.name).toBe('Site A')
    expect(lookup.size).toBe(1)
  })

  it('attachSiteFromScan adds site metadata', () => {
    const lookup = scanSiteLookup(sites)
    const rows = attachSiteFromScan([{ scan: 'scan-a', word: 'test' }], lookup)
    expect(rows[0]).toMatchObject({
      siteId: 'site-a',
      siteName: 'Site A',
      word: 'test'
    })
  })

  it('emptyOrgList returns an empty paginated payload', () => {
    expect(emptyOrgList(2, 20)).toEqual({
      items: [],
      total: 0,
      page: 2,
      perPage: 20
    })
  })
})
