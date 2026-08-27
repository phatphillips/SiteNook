import { describe, expect, it, vi } from 'vitest'
import { persistPdfFileIfMissing, type PdfDocumentRecord } from '../../../src/pdf/pdfDownload.js'
import { hashPdfBuffer } from '../../../src/pdf/pdfIdentity.js'

function mockPb(updateImpl?: (id: string, data: unknown) => Promise<unknown>) {
  return {
    collection: () => ({
      update: updateImpl ?? vi.fn(async () => ({}))
    })
  } as never
}

describe('persistPdfFileIfMissing', () => {
  it('is a no-op for the file field when a file is already stored', async () => {
    const update = vi.fn(async () => ({}))
    const pb = mockPb(update)
    const doc: PdfDocumentRecord = {
      id: 'doc1',
      site: 'site1',
      file: 'existing.pdf',
      content_hash: 'abc'
    }
    const buffer = Buffer.from('%PDF-1.4')
    const stored = await persistPdfFileIfMissing(pb, doc, buffer, 'new.pdf')
    expect(stored).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('backfills content_hash when file exists but hash is missing', async () => {
    const update = vi.fn(async () => ({}))
    const pb = mockPb(update)
    const doc: PdfDocumentRecord = {
      id: 'doc1',
      site: 'site1',
      file: 'existing.pdf'
    }
    const buffer = Buffer.from('%PDF-1.4')
    const hash = hashPdfBuffer(buffer)
    const stored = await persistPdfFileIfMissing(pb, doc, buffer, 'new.pdf', hash)
    expect(stored).toBe(false)
    expect(update).toHaveBeenCalledWith('doc1', { content_hash: hash })
    expect(doc.content_hash).toBe(hash)
  })
})
