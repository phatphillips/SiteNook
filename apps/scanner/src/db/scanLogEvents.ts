import type PocketBase from 'pocketbase'
import type { CrawlDiagnostics } from '../crawler/crawlDiagnostics.js'
import { buildCrawlTip } from '../crawler/crawlDiagnostics.js'

export type ScanLogLevel = 'info' | 'success' | 'warn' | 'error'

export interface ScanLogEventInput {
  level: ScanLogLevel
  message: string
  url?: string
}

const MAX_DETAIL_FAILURE_LOGS = 40

export class ScanLogWriter {
  private pb: PocketBase
  private scanId: string
  private siteId: string
  private failureDetailCount = 0
  private suppressedFailures = 0
  private collectionMissing = false

  constructor(pb: PocketBase, scanId: string, siteId: string) {
    this.pb = pb
    this.scanId = scanId
    this.siteId = siteId
  }

  async append(event: ScanLogEventInput): Promise<void> {
    if (this.collectionMissing) return
    try {
      await this.pb.collection('scan_log_events').create({
        scan: this.scanId,
        site: this.siteId,
        level: event.level,
        message: event.message.slice(0, 2000),
        ...(event.url ? { url: event.url } : {})
      })
    } catch (err) {
      const status = err && typeof err === 'object' && 'status' in err
        ? Number((err as { status: number }).status)
        : 0
      if (status === 404) {
        this.collectionMissing = true
        console.warn('scan_log_events collection not available — live crawl log disabled until migration runs')
        return
      }
      console.warn('Failed to write scan log event:', err)
    }
  }

  async pageCrawled(url: string, title?: string): Promise<void> {
    const label = title?.trim() ? `${title.trim()} — ${url}` : url
    await this.append({ level: 'success', message: `Crawled ${label}`, url })
  }

  async pageFailed(url: string, reason: string): Promise<void> {
    if (this.failureDetailCount < MAX_DETAIL_FAILURE_LOGS) {
      this.failureDetailCount++
      await this.append({ level: 'error', message: reason, url })
      return
    }
    this.suppressedFailures++
  }

  async flushFailureSummary(): Promise<void> {
    if (this.suppressedFailures <= 0) return
    await this.append({
      level: 'warn',
      message: `${this.suppressedFailures} more page failure(s) not shown individually (see crawl summary below)`
    })
    this.suppressedFailures = 0
  }

  async crawlSummary(diag: CrawlDiagnostics, savedPages: number, maxPages: number): Promise<void> {
    await this.flushFailureSummary()
    for (const line of formatDiagnosticsLogLines(diag, savedPages, maxPages)) {
      const level = line.level
      await this.append({ level, message: line.message })
    }
  }
}

export function formatDiagnosticsLogLines(
  diag: CrawlDiagnostics,
  savedPages: number,
  maxPages: number
): Array<{ level: ScanLogLevel, message: string }> {
  const failedAttempts = diag.attempted - diag.succeeded
  const lines: Array<{ level: ScanLogLevel, message: string }> = [
    { level: 'info', message: `Crawl finished: ${diag.stopReason.replace(/_/g, ' ')}` },
    { level: 'info', message: `${savedPages} page(s) saved (limit ${maxPages})` },
    {
      level: 'info',
      message: `Visited ${diag.visitedCount} URL(s), queue remaining ${diag.queueRemaining}`
    }
  ]

  if (diag.seedCount > 0) {
    lines.push({ level: 'info', message: `Sitemap seed: ${diag.seedCount} URL(s)` })
  }

  lines.push({
    level: failedAttempts > savedPages ? 'warn' : 'info',
    message: `Attempts: ${diag.attempted} (${diag.succeeded} OK, ${failedAttempts} failed/skipped)`
  })

  if (diag.httpErrors.size) {
    const parts = [...diag.httpErrors.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code, n]) => `HTTP ${code}: ${n}`)
      .join(', ')
    lines.push({
      level: diag.httpErrors.get(403) ? 'error' : 'warn',
      message: parts
    })
  }

  if (diag.exceptions.size) {
    const parts = [...diag.exceptions.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k}: ${n}`)
      .join(', ')
    lines.push({ level: 'warn', message: `Load errors: ${parts}` })
  }

  const tip = buildCrawlTip(diag)
  if (tip) lines.push({ level: 'warn', message: tip })

  return lines
}
