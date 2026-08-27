import { createHash } from 'node:crypto'
import { normalizeInventoryUrl } from '../qa/inventoryUrl.js'

/** SHA-256 hex digest of PDF bytes — identity key for dedup. */
export function hashPdfBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** Normalize a crawl URL the same way inventory does. */
export function normalizePdfCrawlUrl(url: string): string {
  return normalizeInventoryUrl(String(url ?? '').trim())
}

export type PdfMergeCandidate = {
  id: string
  file?: string
  status?: string
  content_hash?: string
  validated_at?: string
  created?: string
}

/**
 * Prefer the document that already has a stored file and the best validation status.
 * Ties break toward the oldest record so we keep a stable source of truth.
 */
export function pickPdfMergeWinner(
  current: PdfMergeCandidate,
  other: PdfMergeCandidate
): PdfMergeCandidate {
  const currentHasFile = Boolean(current.file)
  const otherHasFile = Boolean(other.file)
  if (currentHasFile !== otherHasFile) {
    return otherHasFile ? other : current
  }

  const statusRank = (status?: string): number => {
    switch (status) {
      case 'complete': return 4
      case 'processing': return 3
      case 'pending': return 2
      case 'failed': return 1
      default: return 0
    }
  }
  const currentRank = statusRank(current.status)
  const otherRank = statusRank(other.status)
  if (currentRank !== otherRank) {
    return otherRank > currentRank ? other : current
  }

  const currentTs = current.validated_at || current.created || ''
  const otherTs = other.validated_at || other.created || ''
  if (currentTs && otherTs && currentTs !== otherTs) {
    return currentTs <= otherTs ? current : other
  }

  return current.id <= other.id ? current : other
}

/** True when we should skip downloading because the winner already has bytes. */
export function shouldSkipPdfDownload(doc: { file?: string }): boolean {
  return Boolean(doc.file)
}
