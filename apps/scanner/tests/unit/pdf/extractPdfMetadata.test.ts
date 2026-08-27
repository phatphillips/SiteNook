import { describe, expect, it } from 'vitest'
import {
  extractPdfMetadata,
  isLinearized,
  parsePdfVersion,
  sanitizePocketBaseText
} from '../../../src/pdf/extractPdfMetadata.js'

function buildTestPdf(): Buffer {
  const body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Hello PDF) Tj ET
endstream
endobj
5 0 obj
<< /Title (Test Document) /Author (Jane Author) /Subject (Test Subject) /Keywords (alpha, beta) /Creator (Word) /Producer (Distiller) >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000206 00000 n 
0000000310 00000 n 
trailer
<< /Size 6 /Root 1 0 R /Info 5 0 R /Linearized 1 >>
startxref
430
%%EOF`
  return Buffer.from(body, 'latin1')
}

describe('extractPdfMetadata', () => {
  it('reads PDF version from header bytes', () => {
    expect(parsePdfVersion(buildTestPdf())).toBe('1.4')
  })

  it('detects linearized PDFs', () => {
    expect(isLinearized(buildTestPdf())).toBe(true)
  })

  it('returns safe empty output for invalid buffers', async () => {
    const result = await extractPdfMetadata(Buffer.from('not a pdf'))
    expect(result.metadata.pageCount).toBeUndefined()
    expect(result.textContent).toBe('')
  })

  it('merges accessibility flags from validation', async () => {
    const result = await extractPdfMetadata(Buffer.from('not a pdf'), {
      hasPdfTags: true,
      machineReadable: true,
      pdfUa: false
    })
    expect(result.metadata.hasTags).toBe(true)
    expect(result.metadata.taggedForAccessibility).toBe(true)
    expect(result.metadata.pdfUa).toBe(false)
  })
})

describe('sanitizePocketBaseText', () => {
  it('strips NUL bytes that PocketBase rejects', () => {
    expect(sanitizePocketBaseText('hello\u0000world')).toBe('helloworld')
  })

  it('caps by UTF-8 bytes rather than JS string length', () => {
    const text = 'é'.repeat(20)
    const out = sanitizePocketBaseText(text, 10)
    expect(Buffer.from(out, 'utf8').byteLength).toBeLessThanOrEqual(10)
    expect(out.length).toBeGreaterThan(0)
  })
})
