import type PocketBase from 'pocketbase'
import { convertPdfTagged } from './opendataloaderClient.js'
import { downloadAndStorePdf, type PdfDocumentRecord } from './pdfDownload.js'
import { mapVeraPdfReport } from './mapVeraPdfReport.js'
import { validatePdfBuffer } from './veraPdfClient.js'
import { buildStructureOutline, computeIssueDelta, computeLiftPercent } from './structureOutline.js'

function textBlob(content: string, mime: string): Blob {
  return new Blob([content], { type: mime })
}

export async function remediatePdfDocument(
  pb: PocketBase,
  documentId: string,
  remediationId?: string
): Promise<string> {
  const doc = await pb.collection('pdf_documents').getOne(documentId) as unknown as PdfDocumentRecord & {
    site?: string
    accessibility_score?: number
    issue_count?: number
    structure_status?: string
  }

  const beforeScore = Number(doc.accessibility_score ?? 0)
  const beforeIssueCount = Number(doc.issue_count ?? 0)
  const started = Date.now()

  let remId = remediationId
  if (!remId) {
    const created = await pb.collection('pdf_remediations').create({
      pdf_document: documentId,
      site: doc.site,
      status: 'processing',
      engine: 'opendataloader',
      artifact_kind: 'suggested_tagged',
      before_score: beforeScore,
      before_issue_count: beforeIssueCount
    })
    remId = created.id
  } else {
    await pb.collection('pdf_remediations').update(remId, {
      status: 'processing',
      error_message: ''
    })
  }

  await pb.collection('pdf_documents').update(documentId, {
    remediation_status: 'processing'
  })

  try {
    const { buffer, filename } = await downloadAndStorePdf(pb, doc)
    const tagged = await convertPdfTagged(buffer, filename, 'json,html,markdown,tagged-pdf')

    const afterReport = await validatePdfBuffer(tagged.taggedPdf, `suggested-${filename}`)
    const afterMapped = mapVeraPdfReport(afterReport)
    const issueDelta = computeIssueDelta(beforeIssueCount, afterMapped.issueCount)
    const liftPercent = computeLiftPercent(beforeIssueCount, afterMapped.issueCount)

    const remForm = new FormData()
    remForm.append('status', 'complete')
    remForm.append('engine', 'opendataloader')
    remForm.append('artifact_kind', 'suggested_tagged')
    remForm.append('before_score', String(beforeScore))
    remForm.append('before_issue_count', String(beforeIssueCount))
    remForm.append('after_score', String(afterMapped.accessibilityScore))
    remForm.append('after_issue_count', String(afterMapped.issueCount))
    remForm.append('issue_delta', String(issueDelta))
    remForm.append('duration_ms', String(Date.now() - started))
    remForm.append('error_message', '')
    remForm.append(
      'summary',
      JSON.stringify({
        liftPercent,
        profile: 'ua1',
        note: 'Assisted fix — re-validate required. Not certified PDF/UA.'
      })
    )
    remForm.append(
      'file',
      new Blob([new Uint8Array(tagged.taggedPdf)], { type: 'application/pdf' }),
      `suggested-tagged-${filename}`
    )
    await pb.collection('pdf_remediations').update(remId, remForm)

    if (tagged.json || tagged.html || tagged.markdown) {
      const outline = buildStructureOutline(tagged.json || '')
      const stem = (filename || 'document').replace(/\.pdf$/i, '') || 'document'
      const structureForm = new FormData()
      structureForm.append('structure_status', 'complete')
      structureForm.append('structure_extracted_at', new Date().toISOString())
      structureForm.append('structure_error', '')
      structureForm.append('structure_outline', JSON.stringify(outline))
      if (tagged.json) {
        structureForm.append('structure_json', textBlob(tagged.json, 'application/json'), `${stem}.json`)
      }
      if (tagged.html) {
        structureForm.append('structure_html', textBlob(tagged.html, 'text/html'), `${stem}.html`)
      }
      if (tagged.markdown) {
        structureForm.append('structure_markdown', textBlob(tagged.markdown, 'text/markdown'), `${stem}.md`)
      }
      structureForm.append('latest_remediation_id', remId)
      structureForm.append('remediation_status', 'complete')
      await pb.collection('pdf_documents').update(documentId, structureForm)
    } else {
      await pb.collection('pdf_documents').update(documentId, {
        latest_remediation_id: remId,
        remediation_status: 'complete'
      })
    }

    return remId
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await pb.collection('pdf_remediations').update(remId, {
      status: 'failed',
      error_message: message.slice(0, 4000),
      duration_ms: Date.now() - started
    })
    await pb.collection('pdf_documents').update(documentId, {
      remediation_status: 'failed'
    })
    throw err
  }
}
