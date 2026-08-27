import { describe, expect, it } from 'vitest'
import {
  parsePdfStudioQuery,
  bboxToCssOverlay,
  fitPdfPreviewScale,
  isPdfInspectorPaneView,
  normalizePdfStudioMode
} from '~/utils/pdfStructureViews'
import { displayPdfFilename } from '~/utils/displayPdfFilename'
import { previewHttpErrorMessage } from '~/utils/fetchAuthedPdf'
import { remediationStatusLabel, structureStatusLabel, buildPdfIssuesCsv } from '~/utils/pdfRemediationExport'
import { computePdfLibraryKpis } from '~/utils/pdfKpis'
import { htmlToGutenbergBlocks, htmlToGutenbergBlocksFallback } from '~/utils/pdfGutenberg'
import {
  buildPdfConvertClipboardText,
  PDF_CONVERT_LLM_PROMPT
} from '~/utils/pdfConvertCopy'
import { crc32, zipStoreFiles } from '~/utils/zipStore'
import type { PdfDocument, PdfIssue, PdfRemediation } from '~/types/sitenook'

describe('displayPdfFilename', () => {
  it('decodes URL-encoded crawl filenames', () => {
    expect(displayPdfFilename('Child%20and%20Student%20Wellbeing.pdf')).toBe(
      'Child and Student Wellbeing.pdf'
    )
    expect(displayPdfFilename('plain.pdf')).toBe('plain.pdf')
    expect(displayPdfFilename(null)).toBe('document.pdf')
  })
})

describe('previewHttpErrorMessage', () => {
  it('prefers server detail for 502 and maps common statuses', () => {
    expect(previewHttpErrorMessage(502, 'Bad Gateway', 'Failed to download crawl PDF: timeout'))
      .toBe('Failed to download crawl PDF: timeout')
    expect(previewHttpErrorMessage(502, 'Bad Gateway')).toContain('502')
    expect(previewHttpErrorMessage(403, 'Forbidden')).toContain('Upload a copy')
    expect(previewHttpErrorMessage(401, 'Unauthorized')).toContain('Sign in')
  })
})

describe('pdfStructureViews', () => {
  it('parses demo-parity query defaults', () => {
    expect(parsePdfStudioQuery({})).toEqual({
      mode: 'audit',
      view1: 'pdf',
      view2: 'markdown',
      content: 'markdown'
    })
    expect(parsePdfStudioQuery({ mode: 'convert', view1: 'json', view2: 'html' })).toEqual({
      mode: 'convert',
      view1: 'json',
      view2: 'html',
      content: 'html'
    })
    expect(parsePdfStudioQuery({ mode: 'convert', content: 'gutenberg' }).content).toBe('gutenberg')
    expect(parsePdfStudioQuery({ mode: 'convert', view2: 'pdf' }).content).toBe('markdown')
    expect(isPdfInspectorPaneView('html')).toBe(true)
    expect(isPdfInspectorPaneView('gutenberg')).toBe(true)
    expect(isPdfInspectorPaneView('image')).toBe(true)
    expect(isPdfInspectorPaneView('docx')).toBe(false)
  })

  it('aliases legacy structure mode to convert', () => {
    expect(normalizePdfStudioMode('structure')).toBe('convert')
    expect(parsePdfStudioQuery({ mode: 'structure', view1: 'json', view2: 'markdown' })).toEqual({
      mode: 'convert',
      view1: 'json',
      view2: 'markdown',
      content: 'markdown'
    })
  })

  it('maps bbox to css overlay', () => {
    const box = bboxToCssOverlay([72, 700, 172, 730], 612, 792, 612, 792)
    expect(box).not.toBeNull()
    expect(box!.width).toBe(100)
    expect(box!.height).toBe(30)
  })

  it('fits preview scale into container with clamps', () => {
    expect(fitPdfPreviewScale(612, 800)).toBeCloseTo((800 - 48) / 612, 5)
    expect(fitPdfPreviewScale(500, 100)).toBe(0.4)
    expect(fitPdfPreviewScale(100, 2000)).toBe(1.5)
    expect(fitPdfPreviewScale(0, 800)).toBe(1)
  })
})

describe('pdfGutenberg', () => {
  it('converts headings and paragraphs to WordPress blocks', () => {
    const html = '<h1>Title</h1><p>Hello <strong>world</strong></p><ul><li>One</li></ul>'
    const blocks = htmlToGutenbergBlocks(html) || htmlToGutenbergBlocksFallback(html)
    expect(blocks).toContain('<!-- wp:heading')
    expect(blocks).toContain('<h1 class="wp-block-heading">Title</h1>')
    expect(blocks).toContain('<!-- wp:paragraph -->')
    expect(blocks).toContain('Hello <strong>world</strong>')
    expect(blocks).toContain('<!-- wp:list -->')
  })

  it('returns empty string for blank input', () => {
    expect(htmlToGutenbergBlocks('')).toBe('')
    expect(htmlToGutenbergBlocks('   ')).toBe('')
  })
})

describe('pdfConvertCopy', () => {
  it('builds clipboard text with optional LLM prompt', () => {
    expect(buildPdfConvertClipboardText('body', false)).toBe('body')
    expect(buildPdfConvertClipboardText('body', true)).toBe(`${PDF_CONVERT_LLM_PROMPT}body`)
    expect(buildPdfConvertClipboardText('  ', true)).toBe('')
  })
})

describe('zipStore', () => {
  it('builds a valid store-method zip with local and central headers', () => {
    const payload = new TextEncoder().encode('hello')
    const zip = zipStoreFiles({ 'hello.txt': payload })
    // Local file header signature
    expect(zip[0]).toBe(0x50)
    expect(zip[1]).toBe(0x4b)
    expect(zip[2]).toBe(0x03)
    expect(zip[3]).toBe(0x04)
    // End of central directory signature somewhere near the end
    const endSig = [0x50, 0x4b, 0x05, 0x06]
    let found = false
    for (let i = zip.length - 22; i >= 0; i--) {
      if (zip[i] === endSig[0] && zip[i + 1] === endSig[1] && zip[i + 2] === endSig[2] && zip[i + 3] === endSig[3]) {
        found = true
        break
      }
    }
    expect(found).toBe(true)
    expect(crc32(payload)).toBe(0x3610a686)
  })
})

describe('pdfRemediationExport', () => {
  it('labels statuses', () => {
    expect(structureStatusLabel('complete')).toContain('ready')
    expect(remediationStatusLabel('complete')).toContain('Assisted fix')
  })

  it('builds issue csv', () => {
    const issues: PdfIssue[] = [{
      id: '1',
      pdf_document: 'd',
      category: 'document',
      rule_id: 'R1',
      title: 'The document is not tagged',
      severity: 'critical'
    }]
    const csv = buildPdfIssuesCsv(issues, { id: 'd', site: 's', source: 'upload', status: 'complete', filename: 'a.pdf' })
    expect(csv).toContain('Rule ID')
    expect(csv).toContain('R1')
  })
})

describe('pdfKpis', () => {
  it('aggregates library coverage and lift', () => {
    const docs: PdfDocument[] = [
      {
        id: '1',
        site: 's',
        source: 'upload',
        status: 'complete',
        structure_status: 'complete',
        remediation_status: 'complete',
        latest_remediation_id: 'r1'
      },
      {
        id: '2',
        site: 's',
        source: 'crawl',
        status: 'complete',
        structure_status: 'pending',
        remediation_status: 'none'
      }
    ]
    const remediations: PdfRemediation[] = [{
      id: 'r1',
      pdf_document: '1',
      site: 's',
      status: 'complete',
      before_issue_count: 10,
      after_issue_count: 4,
      issue_delta: 6,
      summary: { liftPercent: 60 }
    }]
    const kpis = computePdfLibraryKpis(docs, remediations)
    expect(kpis.discovered).toBe(2)
    expect(kpis.validated).toBe(2)
    expect(kpis.structured).toBe(1)
    expect(kpis.remediated).toBe(1)
    expect(kpis.needsHumanFinish).toBe(1)
    expect(kpis.averageLiftPercent).toBe(60)
  })
})
