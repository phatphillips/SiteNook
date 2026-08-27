import type PocketBase from 'pocketbase'
import { extractPdfStructure } from './extractPdfStructure.js'
import { remediatePdfDocument } from './remediatePdfDocument.js'

let isProcessingRemediationQueue = false

export async function recoverStaleRemediationJobs(pb: PocketBase): Promise<void> {
  try {
    const stuck = await pb.collection('pdf_remediation_queue').getFullList({
      filter: "status = 'processing'"
    })
    for (const item of stuck) {
      await pb.collection('pdf_remediation_queue').update(item.id, {
        status: 'pending',
        error_message: 'Recovered from stale processing state'
      })
    }
  } catch {
    // Collection may not exist yet during bootstrap.
  }
}

async function processRemediationQueueItem(pb: PocketBase, queueId: string): Promise<void> {
  const queueItem = await pb.collection('pdf_remediation_queue').getOne(queueId) as {
    pdf_document?: string
    job_type?: string
    remediation?: string
  }
  const documentId = String(queueItem.pdf_document ?? '')
  const jobType = String(queueItem.job_type ?? 'structure')
  if (!documentId) {
    await pb.collection('pdf_remediation_queue').update(queueId, {
      status: 'failed',
      error_message: 'Missing pdf_document relation'
    })
    return
  }

  await pb.collection('pdf_remediation_queue').update(queueId, { status: 'processing' })

  try {
    if (jobType === 'remediate') {
      const remId = await remediatePdfDocument(pb, documentId, queueItem.remediation)
      await pb.collection('pdf_remediation_queue').update(queueId, {
        status: 'complete',
        remediation: remId
      })
    } else {
      await extractPdfStructure(pb, documentId)
      await pb.collection('pdf_remediation_queue').update(queueId, { status: 'complete' })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await pb.collection('pdf_remediation_queue').update(queueId, {
      status: 'failed',
      error_message: message
    })
  }
}

export async function pollPdfRemediationQueue(pb: PocketBase): Promise<void> {
  if (isProcessingRemediationQueue) return
  isProcessingRemediationQueue = true

  try {
    const pending = await pb.collection('pdf_remediation_queue').getList(1, 1, {
      filter: "status = 'pending'",
      sort: '-priority,id'
    })
    if (!pending.items.length) return
    await processRemediationQueueItem(pb, pending.items[0]!.id)
  } catch (err) {
    const status = err && typeof err === 'object' && 'status' in err
      ? Number((err as { status: number }).status)
      : 0
    if (status !== 404) {
      console.warn('PDF remediation queue poll error:', err)
    }
  } finally {
    isProcessingRemediationQueue = false
  }
}

export async function enqueuePdfStructureJob(
  pb: PocketBase,
  documentId: string,
  priority = 5
): Promise<void> {
  await pb.collection('pdf_documents').update(documentId, {
    structure_status: 'pending',
    structure_error: ''
  })
  await pb.collection('pdf_remediation_queue').create({
    pdf_document: documentId,
    job_type: 'structure',
    status: 'pending',
    priority
  })
}

export async function enqueuePdfRemediateJob(
  pb: PocketBase,
  documentId: string,
  siteId: string,
  priority = 10
): Promise<string> {
  const before = await pb.collection('pdf_documents').getOne(documentId) as {
    accessibility_score?: number
    issue_count?: number
  }
  const remediation = await pb.collection('pdf_remediations').create({
    pdf_document: documentId,
    site: siteId,
    status: 'pending',
    engine: 'opendataloader',
    artifact_kind: 'suggested_tagged',
    before_score: Number(before.accessibility_score ?? 0),
    before_issue_count: Number(before.issue_count ?? 0)
  })
  await pb.collection('pdf_documents').update(documentId, {
    remediation_status: 'pending',
    latest_remediation_id: remediation.id
  })
  await pb.collection('pdf_remediation_queue').create({
    pdf_document: documentId,
    job_type: 'remediate',
    status: 'pending',
    priority,
    remediation: remediation.id
  })
  return remediation.id
}
