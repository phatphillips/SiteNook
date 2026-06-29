import { describe, expect, it } from 'vitest'
import { dedupePageUrls, latestPageIdsByNormalizedUrl, normalizePageUrl } from '~/utils/pageUrl'

describe('normalizePageUrl', () => {
  it('treats trailing slash variants as equal', () => {
    const a = 'https://www.anything.tas.gov.au/ambassadors'
    const b = 'https://www.anything.tas.gov.au/ambassadors/'
    expect(normalizePageUrl(a)).toBe(normalizePageUrl(b))
  })

  it('preserves root path slash', () => {
    expect(normalizePageUrl('https://example.com/')).toBe('https://example.com/')
  })
})

describe('dedupePageUrls', () => {
  it('returns one URL per normalized page', () => {
    const urls = dedupePageUrls([
      'https://www.anything.tas.gov.au/ambassadors',
      'https://www.anything.tas.gov.au/ambassadors/',
      'https://www.anything.tas.gov.au/everyone-has-a-role/',
      'https://www.anything.tas.gov.au/parents-and-carers/'
    ])
    expect(urls).toHaveLength(3)
    expect(urls.some(u => u.includes('/ambassadors'))).toBe(true)
    expect(urls.filter(u => u.includes('/ambassadors')).length).toBe(1)
  })

  it('keeps the first seen URL variant for display', () => {
    const urls = dedupePageUrls([
      'https://www.anything.tas.gov.au/ambassadors/',
      'https://www.anything.tas.gov.au/ambassadors'
    ])
    expect(urls).toEqual(['https://www.anything.tas.gov.au/ambassadors/'])
  })
})

describe('latestPageIdsByNormalizedUrl', () => {
  it('includes all pages when every timestamp is zero', () => {
    const allowed = latestPageIdsByNormalizedUrl([
      { id: 'page-a', url: 'https://example.com/a', ts: 0 },
      { id: 'page-b', url: 'https://example.com/b', ts: 0 }
    ])
    expect(allowed.size).toBe(2)
  })

  it('includes all page rows at the latest crawl for the same normalized URL', () => {
    const allowed = latestPageIdsByNormalizedUrl([
      { id: 'page-a', url: 'https://example.com/ambassadors', ts: 100 },
      { id: 'page-b', url: 'https://example.com/ambassadors/', ts: 100 },
      { id: 'page-c', url: 'https://example.com/other', ts: 50 },
      { id: 'page-d', url: 'https://example.com/other/', ts: 100 }
    ])
    expect(allowed.has('page-a')).toBe(true)
    expect(allowed.has('page-b')).toBe(true)
    expect(allowed.has('page-c')).toBe(false)
    expect(allowed.has('page-d')).toBe(true)
  })
})
