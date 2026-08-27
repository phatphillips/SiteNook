import { describe, expect, it } from 'vitest'
import {
  hashPdfBuffer,
  normalizePdfCrawlUrl,
  pickPdfMergeWinner,
  shouldSkipPdfDownload
} from '../../../src/pdf/pdfIdentity.js'

describe('normalizePdfCrawlUrl', () => {
  it('strips query, hash, and trailing slash like inventory', () => {
    expect(normalizePdfCrawlUrl('https://Example.com/docs/a.pdf?x=1#frag')).toBe(
      'https://example.com/docs/a.pdf'
    )
    expect(normalizePdfCrawlUrl('https://example.com/docs/a.pdf/')).toBe(
      'https://example.com/docs/a.pdf'
    )
  })

  it('treats URL variants that normalize equally as the same key', () => {
    const a = normalizePdfCrawlUrl('https://site.test/file.pdf?utm=1')
    const b = normalizePdfCrawlUrl('https://site.test/file.pdf#page=2')
    expect(a).toBe(b)
  })
})

describe('hashPdfBuffer', () => {
  it('returns stable SHA-256 hex for identical bytes', () => {
    const a = hashPdfBuffer(Buffer.from('%PDF-1.4 identical'))
    const b = hashPdfBuffer(Buffer.from('%PDF-1.4 identical'))
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('differs for different bytes', () => {
    const a = hashPdfBuffer(Buffer.from('%PDF-1.4 a'))
    const b = hashPdfBuffer(Buffer.from('%PDF-1.4 b'))
    expect(a).not.toBe(b)
  })
})

describe('pickPdfMergeWinner', () => {
  it('prefers the document that already has a stored file', () => {
    const winner = pickPdfMergeWinner(
      { id: 'a', status: 'complete' },
      { id: 'b', file: 'doc.pdf', status: 'pending' }
    )
    expect(winner.id).toBe('b')
  })

  it('prefers complete validation when both have files', () => {
    const winner = pickPdfMergeWinner(
      { id: 'a', file: 'a.pdf', status: 'pending' },
      { id: 'b', file: 'b.pdf', status: 'complete' }
    )
    expect(winner.id).toBe('b')
  })

  it('keeps the older record when status and file are equal', () => {
    const winner = pickPdfMergeWinner(
      { id: 'z', file: 'a.pdf', status: 'complete', created: '2024-01-02T00:00:00Z' },
      { id: 'a', file: 'b.pdf', status: 'complete', created: '2024-01-01T00:00:00Z' }
    )
    expect(winner.id).toBe('a')
  })
})

describe('shouldSkipPdfDownload', () => {
  it('skips when a file is already stored', () => {
    expect(shouldSkipPdfDownload({ file: 'doc.pdf' })).toBe(true)
    expect(shouldSkipPdfDownload({})).toBe(false)
    expect(shouldSkipPdfDownload({ file: '' })).toBe(false)
  })
})
