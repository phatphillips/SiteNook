import JSZip from 'jszip'

export interface RemediationPackInput {
  filename: string
  originalPdf?: Buffer | null
  suggestedPdf?: Buffer | null
  structureJson?: string
  structureHtml?: string
  structureMarkdown?: string
  issueCsv: string
  summary: Record<string, unknown>
}

export async function buildRemediationPackZip(input: RemediationPackInput): Promise<Buffer> {
  const zip = new JSZip()
  const base = (input.filename || 'document').replace(/\.pdf$/i, '') || 'document'

  if (input.originalPdf?.length) {
    zip.file(`${base}-original.pdf`, input.originalPdf)
  }
  if (input.suggestedPdf?.length) {
    zip.file(`${base}-suggested-tagged.pdf`, input.suggestedPdf)
  }
  if (input.structureJson) zip.file(`${base}-structure.json`, input.structureJson)
  if (input.structureHtml) zip.file(`${base}-structure.html`, input.structureHtml)
  if (input.structureMarkdown) zip.file(`${base}-structure.md`, input.structureMarkdown)
  zip.file(`${base}-issues.csv`, input.issueCsv)
  zip.file(
    `${base}-summary.json`,
    JSON.stringify(
      {
        ...input.summary,
        disclaimer:
          'Suggested Tagged PDF is remediation assist only. Tagged PDF is not certified PDF/UA.'
      },
      null,
      2
    )
  )

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export interface LibraryPackIndexRow {
  documentId: string
  filename: string
  title: string
  score?: number | null
  issueCount?: number | null
  remediationStatus?: string
  structureStatus?: string
}

export function buildLibraryIndexCsv(rows: LibraryPackIndexRow[]): string {
  const headers = [
    'document_id',
    'filename',
    'title',
    'score',
    'issue_count',
    'remediation_status',
    'structure_status'
  ]
  const lines = [headers.join(',')]
  for (const row of rows) {
    const values = [
      row.documentId,
      row.filename,
      row.title,
      row.score ?? '',
      row.issueCount ?? '',
      row.remediationStatus ?? '',
      row.structureStatus ?? ''
    ].map((v) => {
      const s = String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    })
    lines.push(values.join(','))
  }
  return `${lines.join('\n')}\n`
}
