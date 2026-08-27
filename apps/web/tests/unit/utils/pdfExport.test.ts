import { describe, expect, it } from 'vitest'
import { buildPdfDocumentsCsv } from '~/utils/pdfExport'
import { pdfValidationResultLabel } from '~/utils/pdfStatus'
import type { PdfDocument } from '~/types/sitenook'

describe('pdfExport', () => {
  it('builds CSV with headers and escaped values', () => {
    const docs: PdfDocument[] = [{
      id: '1',
      site: 'site1',
      source: 'upload',
      document_title: 'Reading Log',
      filename: 'log.pdf',
      status: 'complete',
      machine_readable: true,
      has_pdf_tags: false,
      issue_count: 4,
      accessibility_score: 72,
      validated_at: '2026-06-04T09:36:00.000Z',
      created: '2026-06-04T09:36:00.000Z'
    }]

    const csv = buildPdfDocumentsCsv(docs)
    expect(csv).toContain('PDF title')
    expect(csv).toContain('Reading Log')
    expect(csv).toContain('log.pdf')
    expect(csv).toContain('4')
  })
})

describe('pdfStatus', () => {
  it('labels validation results for Siteimprove-style status pills', () => {
    expect(pdfValidationResultLabel({ status: 'complete', issue_count: 4 })).toBe('Issues found')
    expect(pdfValidationResultLabel({ status: 'complete', issue_count: 0 })).toBe('No issues')
    expect(pdfValidationResultLabel({ status: 'processing', issue_count: 0 })).toBe('Scanning…')
    expect(pdfValidationResultLabel({ status: 'complete', issue_count: 4, ignored: true })).toBe('Ignored')
  })
})
