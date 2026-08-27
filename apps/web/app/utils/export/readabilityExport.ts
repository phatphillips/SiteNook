import type { ReadabilityMethodId, ReadabilityPageRow } from '~/utils/readabilityMethods'
import {
  buildReadabilityColumnLabels,
  formatReadabilityScore
} from '~/utils/readabilityMethods'
import { buildCsv } from '~/utils/csvExport'
import { isColumnVisible } from '~/utils/tableExportScope'

type ReadabilityRow = ReadabilityPageRow & { siteName?: string }

export function buildReadabilityCsv(
  pages: ReadabilityRow[],
  enabledMethods: ReadabilityMethodId[],
  options?: {
    showSiteColumn?: boolean
    columnVisibility?: Record<string, boolean>
  }
): string {
  const vis = options?.columnVisibility
  const methodLabels = buildReadabilityColumnLabels(enabledMethods)
  const headers: string[] = []

  if (options?.showSiteColumn && isColumnVisible(vis, 'site')) headers.push('Site')
  if (isColumnVisible(vis, 'url')) headers.push('Page URL', 'Title')
  for (const methodId of enabledMethods) {
    const colId = `score_${methodId}`
    if (isColumnVisible(vis, colId)) {
      headers.push(methodLabels[methodId] ?? methodId)
    }
  }

  const rows = pages.map((page) => {
    const cells: string[] = []
    if (options?.showSiteColumn && isColumnVisible(vis, 'site')) {
      cells.push(page.siteName ?? '—')
    }
    if (isColumnVisible(vis, 'url')) {
      cells.push(page.url, page.title ?? '')
    }
    for (const methodId of enabledMethods) {
      const colId = `score_${methodId}`
      if (!isColumnVisible(vis, colId)) continue
      const score = page.scores?.[methodId]
      cells.push(formatReadabilityScore(score))
    }
    return cells
  })

  return buildCsv(headers, rows)
}
