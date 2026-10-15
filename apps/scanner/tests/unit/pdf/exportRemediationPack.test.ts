import { describe, expect, it } from 'vitest'
import { buildLibraryIndexCsv, buildRemediationPackZip } from '../../../src/pdf/exportRemediationPack.js'

describe('exportRemediationPack', () => {
  it('builds a zip with key artifacts', async () => {
    const zip = await buildRemediationPackZip({
      filename: 'demo.pdf',
      originalPdf: Buffer.from('%PDF-1.4 original'),
      suggestedPdf: Buffer.from('%PDF-1.4 suggested'),
      structureJson: '{"elements":[]}',
      structureHtml: '<h1>Demo</h1>',
      structureMarkdown: '# Demo',
      issueCsv: 'rule_id,title\nR1,Missing tags\n',
      summary: { before: 10, after: 4 }
    })
    expect(zip.slice(0, 2).toString()).toBe('PK')
    expect(zip.length).toBeGreaterThan(100)
  })

  it('builds library index csv', () => {
    const csv = buildLibraryIndexCsv([
      {
        documentId: 'd1',
        filename: 'a.pdf',
        title: 'A',
        score: 80,
        issueCount: 2,
        remediationStatus: 'complete',
        structureStatus: 'complete'
      }
    ])
    expect(csv).toContain('document_id')
    expect(csv).toContain('d1')
  })
})
