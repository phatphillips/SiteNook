import { describe, expect, it } from 'vitest'
import { BODY_MAX_CHARS } from '../../../src/search/typesenseConfig.js'
import {
  buildSearchableWebpageBody,
  extractHrefUrlsFromHtml,
  mergeOutboundLinkUrls,
  OUTBOUND_LINKS_SECTION_PREFIX
} from '../../../src/search/outboundLinks.js'

describe('outboundLinks', () => {
  it('extracts http(s) href values from html', () => {
    const html = `
      <a href="/local">Local</a>
      <a href="https://decyp.tas.gov.au/path">DECYP</a>
      <a href="mailto:test@example.com">Mail</a>
    `
    const urls = extractHrefUrlsFromHtml(html, 'https://example.com/page')
    expect(urls).toContain('https://example.com/local')
    expect(urls).toContain('https://decyp.tas.gov.au/path')
    expect(urls.some(url => url.startsWith('mailto:'))).toBe(false)
  })

  it('merges and deduplicates outbound urls', () => {
    expect(mergeOutboundLinkUrls(
      ['https://a.test', 'https://b.test'],
      ['https://a.test', ' https://c.test ']
    )).toEqual([
      'https://a.test',
      'https://b.test',
      'https://c.test'
    ])
  })

  it('appends outbound links after html while respecting body cap', () => {
    const html = 'x'.repeat(BODY_MAX_CHARS)
    const outbound = ['https://decyp.tas.gov.au/', 'https://www.decyp.tas.gov.au/about']
    const body = buildSearchableWebpageBody(html, outbound)

    expect(body.length).toBeLessThanOrEqual(BODY_MAX_CHARS)
    expect(body).toContain(OUTBOUND_LINKS_SECTION_PREFIX)
    expect(body).toContain('https://decyp.tas.gov.au/')
    expect(body).toContain('https://www.decyp.tas.gov.au/about')
  })
})
