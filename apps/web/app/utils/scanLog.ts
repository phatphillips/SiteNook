import type { Scan } from '~/types/accessiq'

/** One-line scan log summary for the Scans page (Siteimprove-style). */
export function formatScanLogLine(scan: Scan): string {
  const parts: string[] = []

  if (scan.status === 'failed') {
    parts.push('Failed')
  } else if (scan.status === 'cancelled') {
    parts.push('Cancelled')
  } else if (scan.status === 'complete') {
    parts.push('Completed')
  } else if (scan.status === 'running') {
    parts.push(`Running · ${scan.pages_crawled ?? 0} pages`)
    return parts.join(' · ')
  } else {
    parts.push(scan.status)
  }

  const pages = scan.pages_crawled ?? 0
  parts.push(`${pages} ${pages === 1 ? 'page' : 'pages'}`)

  if (scan.status === 'failed' && scan.error_message) {
    parts.push(scan.error_message)
  }

  return parts.join(' · ')
}

export function formatScanDiffLine(scan: Scan): string | null {
  const diff = scan.diff_summary
  if (!diff || scan.status !== 'complete') return null
  const { new_issues: added, fixed_issues: fixed } = diff
  if (!added && !fixed) return null
  const segments: string[] = []
  if (fixed > 0) segments.push(`${fixed} fixed`)
  if (added > 0) segments.push(`${added} new`)
  return segments.join(', ')
}

/** Collapsed scan row summary (pages + diff/error; status lives in the badge). */
export function formatScanRunSummary(scan: Scan): string {
  const pages = scan.pages_crawled ?? 0
  const pagePart = `${pages} ${pages === 1 ? 'page' : 'pages'}`

  if (scan.status === 'running') {
    return pagePart
  }

  if (scan.status === 'failed' && scan.error_message) {
    return `${pagePart} · ${scan.error_message}`
  }

  if (scan.status === 'complete') {
    const diff = formatScanDiffLine(scan)
    if (diff) return `${pagePart} · ${diff}`
  }

  return pagePart
}

/** Expanded diff detail for completed scans. */
export function formatScanDiffDetail(scan: Scan): string | null {
  const diff = scan.diff_summary
  if (!diff || scan.status !== 'complete') return null

  const parts: string[] = []
  if (diff.fixed_issues > 0) {
    parts.push(`${diff.fixed_issues} issue${diff.fixed_issues === 1 ? '' : 's'} fixed since last scan`)
  }
  if (diff.new_issues > 0) {
    parts.push(`${diff.new_issues} new issue${diff.new_issues === 1 ? '' : 's'}`)
  }
  if (diff.unchanged > 0) {
    parts.push(`${diff.unchanged} unchanged`)
  }

  return parts.length ? parts.join(' · ') : null
}

/** Compact changes line for expanded scan detail card. */
export function formatScanChangesCompact(scan: Scan): string {
  if (scan.status === 'failed' && scan.error_message) {
    return scan.error_message
  }

  const diff = scan.diff_summary
  if (!diff || scan.status !== 'complete') {
    return '—'
  }

  const parts: string[] = []
  if (diff.fixed_issues > 0) {
    parts.push(`${diff.fixed_issues} fixed`)
  }
  if (diff.new_issues > 0) {
    parts.push(`${diff.new_issues} new issue${diff.new_issues === 1 ? '' : 's'}`)
  }
  if (!parts.length && diff.unchanged > 0) {
    return 'No new or fixed issues'
  }
  return parts.length ? parts.join(' · ') : '—'
}
