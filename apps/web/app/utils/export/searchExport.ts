import type { GlobalSearchResultItem } from '~/types/globalSearch'
import { buildCsv } from '~/utils/csvExport'
import { format } from 'date-fns'

export function buildSearchResultsCsv(
  items: GlobalSearchResultItem[],
  options?: { showSiteColumn?: boolean }
): string {
  const headers = options?.showSiteColumn
    ? ['Site', 'URL', 'Type', 'Matched in', 'Snippet', 'Last scanned']
    : ['URL', 'Type', 'Matched in', 'Snippet', 'Last scanned']

  const rows = items.map((item) => {
    const scanned = item.lastScannedAt
      ? format(new Date(item.lastScannedAt), 'yyyy-MM-dd HH:mm')
      : ''
    const cells = [
      item.url,
      item.type,
      item.matchedIn,
      item.snippet,
      scanned
    ]
    if (options?.showSiteColumn) {
      return [item.siteName, ...cells]
    }
    return cells
  })

  return buildCsv(headers, rows)
}
