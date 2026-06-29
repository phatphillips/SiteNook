import type PocketBase from 'pocketbase'
import { validatePdfDocument } from './validatePdfDocument.js'

let isProcessingPdfQueue = false

export async function recoverStalePdfJobs(pb: PocketBase): Promise<void> {
  try {
    const stuck = await pb.collection('pdf_validation_queue').getFullList({
      filter: "status = 'processing'"
    })
    for (const item of stuck) {
      await pb.collection('pdf_validation_queue').update(item.id, {
        status: 'pending',
        error_message: 'Recovered from stale processing state'
      })
    }
  } catch {
    // Collection may not exist yet during bootstrap.
  }
}

async function processPdfQueueItem(pb: PocketBase, queueId: string): Promise<void> {
  const queueItem = await pb.collection('pdf_validation_queue').getOne(queueId)
  const documentId = String((queueItem as { pdf_document?: string }).pdf_document ?? '')
  if (!documentId) {
    await pb.collection('pdf_validation_queue').update(queueId, {
      status: 'failed',
      error_message: 'Missing pdf_document relation'
    })
    return
  }

  await pb.collection('pdf_validation_queue').update(queueId, { status: 'processing' })

  try {
    await validatePdfDocument(pb, documentId)
    await pb.collection('pdf_validation_queue').update(queueId, { status: 'complete' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await pb.collection('pdf_validation_queue').update(queueId, {
      status: 'failed',
      error_message: message
    })
  }
}

export async function pollPdfValidationQueue(pb: PocketBase): Promise<void> {
  if (isProcessingPdfQueue) return
  isProcessingPdfQueue = true

  try {
    const pending = await pb.collection('pdf_validation_queue').getList(1, 1, {
      filter: "status = 'pending'",
      sort: '-priority,id'
    })
    if (!pending.items.length) return
    await processPdfQueueItem(pb, pending.items[0]!.id)
  } catch (err) {
    const status = err && typeof err === 'object' && 'status' in err
      ? Number((err as { status: number }).status)
      : 0
    if (status !== 404) {
      console.warn('PDF validation queue poll error:', err)
    }
  } finally {
    isProcessingPdfQueue = false
  }
}

export function startPdfValidationPollLoop(pb: PocketBase, intervalMs: number): void {
  async function loop() {
    await pollPdfValidationQueue(pb)
    setTimeout(loop, intervalMs)
  }
  loop()
}
