import { describe, expect, it } from 'vitest'
import {
  buildPdfDocument,
  buildWebpageDocument,
  pdfDocId,
  webpageDocId
} from '../../../src/search/searchDocument.js'
import { BODY_MAX_CHARS } from '../../../src/search/typesenseConfig.js'

describe('searchDocument', () => {
  it('builds webpage document with capped body and stable id', () => {
    const html = 'x'.repeat(BODY_MAX_CHARS + 500)
    const doc = buildWebpageDocument({
      pageId: 'page1',
      orgId: 'org1',
      siteId: 'site1',
      siteName: 'Example',
      url: 'https://Example.com/path/',
      title: 'Home',
      htmlSnapshot: html,
      outboundLinkUrls: ['https://decyp.tas.gov.au/'],
      lastScannedAt: 1_700_000_000_000
    })

    expect(doc.id).toBe(webpageDocId('page1'))
    expect(doc.type).toBe('webpage')
    expect(doc.urlKey).toBe('https://example.com/path')
    expect(doc.body.length).toBeLessThanOrEqual(BODY_MAX_CHARS)
    expect(doc.body).toContain('https://decyp.tas.gov.au/')
    expect(doc.pageId).toBe('page1')
  })

  it('builds pdf document with flattened metadata fields', () => {
    const doc = buildPdfDocument({
      pdfDocumentId: 'pdf1',
      orgId: 'org1',
      siteId: 'site1',
      siteName: 'Example',
      url: 'https://example.com/file.pdf',
      documentTitle: 'Annual Report',
      textContent: 'Chapter one',
      metadata: {
        author: 'Jane Doe',
        subject: 'Finance',
        keywords: 'annual, report'
      },
      lastScannedAt: 1_700_000_000_000
    })

    expect(doc.id).toBe(pdfDocId('pdf1'))
    expect(doc.type).toBe('pdf')
    expect(doc.pdfAuthor).toBe('Jane Doe')
    expect(doc.pdfSubject).toBe('Finance')
    expect(doc.pdfKeywords).toBe('annual, report')
    expect(doc.pdfDocumentId).toBe('pdf1')
  })
})
