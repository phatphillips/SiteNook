import type { Scan, Site } from '~/types/sitenook'
import { pickLatestTerminalScan } from '~/utils/workspaceScanQuery'

export interface ContentExplorerSiteRow {
  siteId: string
  siteName: string
  siteUrl: string
  pageCount: number
  lastScanAt: string | null
}

export function buildContentExplorerSiteRows(
  sites: Site[],
  scansBySiteId: Record<string, Scan[]>
): ContentExplorerSiteRow[] {
  return sites.map((site) => {
    const latest = pickLatestTerminalScan(scansBySiteId[site.id] ?? [])
    return {
      siteId: site.id,
      siteName: site.name,
      siteUrl: site.url,
      pageCount: Number(latest?.pages_crawled ?? 0),
      lastScanAt: latest?.completed_at || latest?.created || null
    }
  })
}
