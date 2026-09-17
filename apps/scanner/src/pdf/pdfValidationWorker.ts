import type PocketBase from 'pocketbase'
import { downloadAndStorePdf, type PdfDocumentRecord } from './pdfDownload.js'
import { validatePdfDocument } from './validatePdfDocument.js'

let isProcessingPdfQueue = false

/** Skip retrying docs that recently failed (e.g. permanent 403). */
const backfillSkipUntil = new Map<string, number>()
/** Global pause after a backfill miss/failure so we do not spam every poll tick. */
let backfillCooldownUntil = 0
let lastBackfillWarnAt = 0
let lastBackfillWarnMsg = ''

const BACKFILL_IDLE_COOLDOWN_MS = 5 * 60_000
/** After any store failure — give PocketBase breathing room (was 30s; caused log floods). */
const BACKFILL_FAIL_COOLDOWN_MS = 5 * 60_000
/** When PocketBase returns a generic 400/timeout with no candidate, back off harder. */
const BACKFILL_OVERLOAD_COOLDOWN_MS = 15 * 60_000
const BACKFILL_HARD_FAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000
const BACKFILL_SOFT_FAIL_COOLDOWN_MS = 60 * 60 * 1000
const BACKFILL_WARN_THROTTLE_MS = 5 * 60_000

function backfillEnabled(): boolean {
  const raw = process.env.SCANNER_PDF_STORE_BACKFILL
  if (raw == null || raw === '') return true
  return !['0', 'false', 'off', 'no'].includes(raw.trim().toLowerCase())
}

function warnBackfill(message: string): void {
  const now = Date.now()
  if (message === lastBackfillWarnMsg && now - lastBackfillWarnAt < BACKFILL_WARN_THROTTLE_MS) {
    return
  }
  lastBackfillWarnAt = now
  lastBackfillWarnMsg = message
  console.warn(message)
}

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

function pdfFileMissing(item: { file?: unknown, url?: unknown }): boolean {
  const fileRaw = item.file
  const file = Array.isArray(fileRaw)
    ? String(fileRaw[0] ?? '').trim()
    : String(fileRaw ?? '').trim()
  const url = String(item.url ?? '').trim()
  return !file && Boolean(url)
}

function extractHttpStatus(err: unknown): number {
  if (!err || typeof err !== 'object') return 0
  const withStatus = err as { status?: number, message?: string }
  if (typeof withStatus.status === 'number' && withStatus.status > 0) {
    return withStatus.status
  }
  const match = String(withStatus.message ?? '').match(/\((\d{3})\)\s*$/)
  return match ? Number(match[1]) : 0
}

function formatPbError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const extra = err && typeof err === 'object' && 'response' in err
    ? (err as { response?: unknown }).response
    : undefined
  if (extra && typeof extra === 'object' && Object.keys(extra as object).length) {
    try {
      return `${err.message} ${JSON.stringify(extra)}`
    } catch {
      return err.message
    }
  }
  const cause = err && typeof err === 'object' && 'originalError' in err
    ? (err as { originalError?: { cause?: { code?: string }, message?: string } }).originalError
    : undefined
  const code = cause?.cause?.code || cause?.message
  return code ? `${err.message} (${code})` : err.message
}

/**
 * Backfill: store one crawl PDF that still has only a remote URL (no PocketBase file).
 * Runs opportunistically alongside validation polling so existing docs gain preview without a rescan.
 * Failed docs (403/404/etc.) are skipped for a cooldown so they cannot flood logs every poll.
 */
export async function storeOneMissingCrawlPdfFile(pb: PocketBase): Promise<boolean> {
  if (!backfillEnabled()) return false
  if (Date.now() < backfillCooldownUntil) return false

  let candidateId: string | null = null
  try {
    const list = await pb.collection('pdf_documents').getList(1, 50, {
      filter: 'source = "crawl"',
      // Prefer -updated when autodate exists; -id always works (PB 0.22+ may lack autodate).
      sort: '-id'
    })
    const now = Date.now()
    const missing = list.items.find((item) => {
      if ((backfillSkipUntil.get(item.id) ?? 0) > now) return false
      return pdfFileMissing(item as { file?: unknown, url?: unknown })
    }) as unknown as PdfDocumentRecord | undefined

    if (!missing) {
      backfillCooldownUntil = Date.now() + BACKFILL_IDLE_COOLDOWN_MS
      return false
    }

    candidateId = missing.id
    await downloadAndStorePdf(pb, missing)
    console.log(`Backfilled stored crawl PDF ${missing.id} (${missing.url})`)
    return true
  } catch (err) {
    const status = extractHttpStatus(err)
    const hardFail = status === 403 || status === 404 || status === 410
    const overloaded = status === 0 || status === 400 || status === 429 || status === 503
    if (candidateId) {
      backfillSkipUntil.set(
        candidateId,
        Date.now() + (hardFail ? BACKFILL_HARD_FAIL_COOLDOWN_MS : BACKFILL_SOFT_FAIL_COOLDOWN_MS)
      )
    }
    backfillCooldownUntil = Date.now() + (
      !candidateId || overloaded ? BACKFILL_OVERLOAD_COOLDOWN_MS : BACKFILL_FAIL_COOLDOWN_MS
    )
    warnBackfill(`Crawl PDF store backfill failed: ${formatPbError(err)}`)
    return false
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
    if (pending.items.length) {
      await processPdfQueueItem(pb, pending.items[0]!.id)
      return
    }
    // Idle: opportunistically store crawl PDFs that still lack a file.
    await storeOneMissingCrawlPdfFile(pb)
  } catch (err) {
    const status = err && typeof err === 'object' && 'status' in err
      ? Number((err as { status: number }).status)
      : 0
    if (status !== 404) {
      console.warn('PDF validation queue poll error:', formatPbError(err))
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

/** Test helper — clear cooldowns between unit tests. */
export function resetPdfBackfillStateForTests(): void {
  backfillSkipUntil.clear()
  backfillCooldownUntil = 0
  lastBackfillWarnAt = 0
  lastBackfillWarnMsg = ''
}
