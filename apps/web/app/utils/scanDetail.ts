import { format } from 'date-fns'
import type { Scan } from '~/types/accessiq'
import {
  browserSummary,
  parseScanConfig,
  scheduleSummary,
  scopeSummary
} from '~/utils/scanConfig'
import { formatScanChangesCompact } from '~/utils/scanLog'
import { scanTimestamp } from '~/utils/scanDisplay'

export function scanSiteName(scan: Scan): string {
  return scan.expand?.site?.name?.trim() || 'Site'
}

/** Registered site URL from PocketBase (`sites.url`). */
export function scanSiteUrl(scan: Scan): string | null {
  const url = scan.expand?.site?.url?.trim()
  return url || null
}

export function formatScanModalTitle(scan: Scan): string {
  const siteName = scanSiteName(scan)
  const ts = scanTimestamp(scan)
  if (!ts) return `${siteName} scan summary`
  try {
    const when = format(new Date(ts), 'd MMMM yyyy, h:mm:ss a')
    return `${siteName} scan summary - ${when}`
  } catch {
    return `${siteName} scan summary - ${ts}`
  }
}

export function formatScanTypeLabel(scanType?: string): string {
  if (!scanType) return 'Full'
  return scanType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatDiffFingerprintLine(key: string): string {
  const parts = key.split('::')
  if (parts.length >= 3) {
    const page = parts[0]
    const rule = parts[1]
    const selector = parts.slice(2).join('::')
    return `${rule} on ${page}${selector ? ` (${selector})` : ''}`
  }
  return key
}

export interface ScanConfigLine {
  label: string
  value: string
}

export function scanConfigLines(scan: Scan): ScanConfigLine[] {
  if (!scan.raw_config) {
    return [{ label: 'Configuration', value: 'No configuration stored for this scan.' }]
  }
  const config = parseScanConfig(scan.raw_config)
  return [
    { label: 'Scope', value: scopeSummary(config, scan.pages_crawled) },
    { label: 'Schedule', value: scheduleSummary(config) },
    { label: 'Browser', value: browserSummary(config) },
    { label: 'Inventory', value: 'Full accessibility + QA (all checks run)' },
    { label: 'Max depth', value: String(config.maxDepth) },
    { label: 'Stay on domain', value: config.stayOnDomain ? 'Yes' : 'No' },
    { label: 'Respect robots.txt', value: config.respectRobots ? 'Yes' : 'No' }
  ]
}

export function scanSummaryLines(scan: Scan): ScanConfigLine[] {
  return [
    { label: 'Pages crawled', value: String(scan.pages_crawled ?? 0) },
    {
      label: 'Accessibility score',
      value: scan.score_overall != null
        ? `${scan.score_overall}%`
        : scan.score_aa != null
          ? `${scan.score_aa}%`
          : '—'
    },
    { label: 'Level AA', value: scan.score_aa != null ? `${scan.score_aa}%` : '—' },
    { label: 'QA score', value: scan.score_qa != null ? `${scan.score_qa}%` : '—' },
    { label: 'Changes', value: formatScanChangesCompact(scan) }
  ]
}

export function scanDiffNewLines(scan: Scan): string[] {
  const diff = scan.diff_summary
  if (!diff?.new_issue_ids?.length) {
    if (diff && diff.new_issues > 0) {
      return [`${diff.new_issues} new issue${diff.new_issues === 1 ? '' : 's'} (details not stored)`]
    }
    return []
  }
  return diff.new_issue_ids.map(formatDiffFingerprintLine)
}

export function scanDiffFixedLines(scan: Scan): string[] {
  const diff = scan.diff_summary
  if (!diff?.fixed_issue_keys?.length) {
    if (diff && diff.fixed_issues > 0) {
      return [`${diff.fixed_issues} issue${diff.fixed_issues === 1 ? '' : 's'} fixed (details not stored)`]
    }
    return []
  }
  return diff.fixed_issue_keys.map(formatDiffFingerprintLine)
}

export function showScanChangesSection(scan: Scan): boolean {
  return scan.status === 'complete' || scan.status === 'running'
}

export function showScanErrorSection(scan: Scan): boolean {
  return scan.status === 'failed' && Boolean(scan.error_message)
}

export function scanUnscannedUrls(scan: Scan): string[] {
  if (!scan.unscanned_urls?.length) return []
  return scan.unscanned_urls
}

export function showUnscannedPagesSection(scan: Scan): boolean {
  return scanUnscannedUrls(scan).length > 0
}
