import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import {
  extractSectionPageMap,
  renderSectionMarker,
  stampReportChrome,
  SECTION_MARKER_PREFIX,
  SECTION_MARKER_SUFFIX
} from '../../../src/reports/reportChrome.js'

describe('reportChrome', () => {
  it('renders extractable section markers', () => {
    const html = renderSectionMarker('Executive summary', 'section-executive-summary')
    expect(html).toContain(`${SECTION_MARKER_PREFIX}Executive summary|section-executive-summary${SECTION_MARKER_SUFFIX}`)
  })

  it('maps section markers across pages and stamps chrome on content pages', async () => {
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const cover = pdfDoc.addPage([595, 842])
    cover.drawText('Cover', { x: 50, y: 800, size: 12, font })

    const toc = pdfDoc.addPage([595, 842])
    toc.drawText(`%%AIQSEC:Table of contents|section-table-of-contents%%`, {
      x: 50,
      y: 800,
      size: 8,
      font
    })

    const issues = pdfDoc.addPage([595, 842])
    issues.drawText(`%%AIQSEC:Accessibility Issues|section-accessibility-issues%%`, {
      x: 50,
      y: 800,
      size: 8,
      font
    })

    const issuesCont = pdfDoc.addPage([595, 842])
    issuesCont.drawText('continued rows', { x: 50, y: 800, size: 10, font })

    const bytes = Buffer.from(await pdfDoc.save())
    const map = await extractSectionPageMap(bytes)

    expect(map.totalPages).toBe(4)
    expect(map.sectionStartPages['section-table-of-contents']).toBe(2)
    expect(map.sectionStartPages['section-accessibility-issues']).toBe(3)
    expect(map.eyebrowsByPage[0]).toBe('')
    expect(map.eyebrowsByPage[1]).toBe('Table of contents')
    expect(map.eyebrowsByPage[2]).toBe('Accessibility Issues')
    expect(map.eyebrowsByPage[3]).toBe('Accessibility Issues')

    const stamped = await stampReportChrome(bytes, {
      orgName: 'Monkey',
      scopeLabel: 'All sites',
      generatedAtLabel: 'Jul 10, 2026, 10:12 AM'
    }, map.eyebrowsByPage, { startIndex: 1 })

    expect(stamped.slice(0, 4).toString('utf8')).toBe('%PDF')
    expect(stamped.length).toBeGreaterThan(bytes.length)
  })
})
