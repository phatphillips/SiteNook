export type CrawlStopReason =
  | 'queue_empty'
  | 'max_pages'
  | 'aborted'
  | 'stuck_queue'

export function isCrawlDebugEnabled(): boolean {
  const v = process.env.SCANNER_CRAWL_DEBUG?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export class CrawlDiagnostics {
  readonly enabled: boolean
  seedCount = 0
  dequeueSkippedVisited = 0
  dequeueSkippedRobots = 0
  attempted = 0
  succeeded = 0
  httpErrors = new Map<number, number>()
  exceptions = new Map<string, number>()
  linksEnqueued = 0
  linksSkippedVisited = 0
  linksSkippedRobots = 0
  stopReason: CrawlStopReason = 'queue_empty'
  queueRemaining = 0
  visitedCount = 0
  /** URLs that returned HTTP 403 after WAF retries (candidates for background scan). */
  unscannedUrls: string[] = []

  constructor(enabled = isCrawlDebugEnabled()) {
    this.enabled = enabled
  }

  recordSeed(count: number): void {
    this.seedCount = count
  }

  recordDequeueSkip(reason: 'visited' | 'robots'): void {
    if (reason === 'visited') this.dequeueSkippedVisited++
    else this.dequeueSkippedRobots++
    if (this.enabled) {
      console.debug(`[crawl] dequeued skip: ${reason}`)
    }
  }

  recordAttempt(): void {
    this.attempted++
  }

  recordSuccess(): void {
    this.succeeded++
  }

  recordHttpError(status: number, url: string): void {
    this.httpErrors.set(status, (this.httpErrors.get(status) || 0) + 1)
    if (status === 403 && !this.unscannedUrls.includes(url)) {
      this.unscannedUrls.push(url)
    }
    if (this.enabled) {
      console.debug(`[crawl] HTTP ${status} ${url}`)
    }
  }

  recordException(url: string, err: unknown): void {
    const key = classifyCrawlError(err)
    this.exceptions.set(key, (this.exceptions.get(key) || 0) + 1)
    if (this.enabled) {
      console.debug(`[crawl] error (${key}) ${url}:`, err)
    }
  }

  recordLinksEnqueued(count: number): void {
    this.linksEnqueued += count
  }

  recordLinkSkip(reason: 'visited' | 'robots', count = 1): void {
    if (reason === 'visited') this.linksSkippedVisited += count
    else this.linksSkippedRobots += count
  }

  finish(opts: {
    stopReason: CrawlStopReason
    queueRemaining: number
    visitedCount: number
    resultsCount: number
    maxPages: number
  }): void {
    this.stopReason = opts.stopReason
    this.queueRemaining = opts.queueRemaining
    this.visitedCount = opts.visitedCount
    this.logSummary(opts.resultsCount, opts.maxPages)
  }

  logSummary(resultsCount: number, maxPages: number): void {
    const failedAttempts = this.attempted - this.succeeded
    const lines = [
      '── Crawl diagnostics ──',
      `Stop reason: ${this.stopReason}`,
      `Results: ${resultsCount} page(s) saved (limit ${maxPages})`,
      `Visited URLs: ${this.visitedCount} | Queue remaining: ${this.queueRemaining}`,
      `Seeded URLs: ${this.seedCount || '—'}`,
      `Attempts: ${this.attempted} (${this.succeeded} OK, ${failedAttempts} failed/skipped after load)`
    ]

    if (this.dequeueSkippedVisited || this.dequeueSkippedRobots) {
      lines.push(
        `Dequeue skips: ${this.dequeueSkippedVisited} already visited, ${this.dequeueSkippedRobots} blocked by robots.txt`
      )
    }

    if (this.httpErrors.size) {
      lines.push(`HTTP errors: ${formatCountMap(this.httpErrors)}`)
    }

    if (this.exceptions.size) {
      lines.push(`Load/scan errors: ${formatCountMap(this.exceptions)}`)
    }

    if (this.linksEnqueued || this.linksSkippedVisited || this.linksSkippedRobots) {
      lines.push(
        `Link discovery: ${this.linksEnqueued} enqueued, ${this.linksSkippedVisited} already visited, ${this.linksSkippedRobots} robots-blocked`
      )
    }

    const tip = buildCrawlTip(this)
    if (tip) lines.push(tip)

    console.log(lines.join('\n'))
  }
}

export function classifyCrawlError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/timeout/i.test(message)) return 'timeout'
  if (/net::ERR_/i.test(message)) return 'network'
  if (/NS_ERROR_/i.test(message)) return 'network'
  if (/cancelled|canceled/i.test(message)) return 'cancelled'
  return 'other'
}

export function buildCrawlTip(diag: CrawlDiagnostics): string | null {
  const failedAttempts = diag.attempted - diag.succeeded
  if (failedAttempts <= 0) return null

  const forbidden = diag.httpErrors.get(403) || 0
  if (forbidden >= failedAttempts * 0.5) {
    return (
      'Tip: Most failures are HTTP 403 (WAF / rate limit). The scanner retries after 5s and 10s; use wait strategy "Delay 10s", concurrency 1, ' +
      'or request WAF allowlisting for your scanner IP. SCANNER_CRAWL_DEBUG=1 logs each URL.'
    )
  }

  const timeouts = diag.exceptions.get('timeout') || 0
  if (timeouts >= failedAttempts * 0.3) {
    return (
      'Tip: Many pages timed out. Try wait strategy "load", increase timeout in scan config, or lower concurrency. ' +
      'SCANNER_CRAWL_DEBUG=1 for per-URL logs.'
    )
  }

  if (diag.seedCount > 0 && diag.succeeded < diag.seedCount) {
    return (
      'Tip: Check HTTP errors above. Set SCANNER_CRAWL_DEBUG=1 for per-URL detail, or adjust wait strategy / timeout in scan config.'
    )
  }

  return null
}

function formatCountMap(map: Map<number | string, number>): string {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}: ${n}`)
    .join(', ')
}
