import type PocketBase from 'pocketbase'
import type { ScanLogEvent } from '~/types/accessiq'
import { pbRelation } from '~/utils/pbFilter'
import {
  eventToLine,
  formatCrawlLogLinesAsText,
  type CrawlLogLine
} from '~/utils/crawlLog'

/** Fetch every persisted log line for a scan (authoritative full log). */
export async function fetchFullScanLogLines(
  pb: PocketBase,
  scanId: string
): Promise<CrawlLogLine[]> {
  const events = await pb.collection('scan_log_events').getFullList({
    filter: pbRelation('scan', scanId),
    sort: 'created'
  })
  return (events as unknown as ScanLogEvent[]).map(eventToLine)
}

export async function buildFullScanLogDownload(
  pb: PocketBase,
  scanId: string,
  meta?: { siteName?: string }
): Promise<string> {
  const lines = await fetchFullScanLogLines(pb, scanId)
  const header = [
    '# AccessIQ crawl log',
    `# scan_id: ${scanId}`,
    meta?.siteName ? `# site: ${meta.siteName}` : '',
    `# exported: ${new Date().toISOString()}`,
    ''
  ].filter(Boolean).join('\n')
  return `${header}\n${formatCrawlLogLinesAsText(lines)}`
}

export function triggerScanLogDownload(text: string, scanId: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `scan-${scanId.slice(0, 8)}-crawl.log`
  anchor.click()
  URL.revokeObjectURL(url)
}
