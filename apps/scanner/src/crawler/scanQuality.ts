import type { CrawlDiagnostics } from './crawlDiagnostics.js'
import type { PageResult } from './siteCrawler.js'

export const HIGH_ERROR_RATE = 0.3
export const HIGH_AXE_FAILURE_RATE = 0.3
export const LOW_COVERAGE_RATIO = 0.5
export const LOW_COVERAGE_PREVIOUS_MIN = 10

export interface ScanQualityOptions {
  mode?: string
  previousTrustedPages?: number
}

export interface ScanQuality {
  pages_attempted: number
  pages_saved: number
  axe_failed: number
  http_errors: number
  timeouts: number
  network_errors: number
  trusted: boolean
  reason?: string
}

function mapSum(map: Map<unknown, number>): number {
  let total = 0
  for (const n of map.values()) total += n
  return total
}

export function evaluateScanQuality(
  diag: CrawlDiagnostics,
  pages: PageResult[],
  options?: ScanQualityOptions
): ScanQuality {
  const axeFailed = pages.filter(page => page.a11yFailed).length
  const httpErrors = mapSum(diag.httpErrors)
  const timeouts = diag.exceptions.get('timeout') ?? 0
  const networkErrors = diag.exceptions.get('network') ?? 0
  const attempted = diag.attempted
  const saved = pages.length
  const failedAttempts = Math.max(0, attempted - diag.succeeded)

  let trusted = true
  let reason: string | undefined

  if (saved === 0) {
    trusted = false
    reason = attempted > 0
      ? 'No pages could be saved'
      : 'Start URL could not be crawled'
  } else if (attempted > 0 && failedAttempts / attempted >= HIGH_ERROR_RATE) {
    trusted = false
    reason = `High crawl error rate (${failedAttempts}/${attempted} failed)`
  } else if (saved > 0 && axeFailed / saved >= HIGH_AXE_FAILURE_RATE) {
    trusted = false
    reason = `Accessibility checks failed on ${axeFailed}/${saved} page(s)`
  } else if (options?.mode === 'pages') {
    trusted = false
    reason = 'Pages-mode scan is not a full-site baseline'
  } else if (
    options?.previousTrustedPages != null
    && options.previousTrustedPages >= LOW_COVERAGE_PREVIOUS_MIN
    && saved < options.previousTrustedPages * LOW_COVERAGE_RATIO
  ) {
    trusted = false
    reason = `Low coverage (${saved} of ${options.previousTrustedPages} pages vs last trusted scan)`
  }

  return {
    pages_attempted: attempted,
    pages_saved: saved,
    axe_failed: axeFailed,
    http_errors: httpErrors,
    timeouts,
    network_errors: networkErrors,
    trusted,
    reason
  }
}

export function previousTrustedPageCount(
  scans: Array<{ pages_crawled?: number, scan_quality?: { trusted?: boolean } | null }>
): number | undefined {
  const trusted = scans.find(scan => scan.scan_quality?.trusted !== false)
  const count = trusted?.pages_crawled
  return typeof count === 'number' && count > 0 ? count : undefined
}
