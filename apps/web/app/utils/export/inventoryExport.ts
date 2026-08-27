import type { InventorySourcePageSummary } from '~/types/sitenook'
import type { OrgInventoryPageRow } from '~/composables/useOrgInventory'
import type { OrgInventoryAssetRow } from '~/composables/useOrgInventory'
import type { OrgInventoryTab } from '~/composables/useOrgInventory'
import { buildCsv } from '~/utils/csvExport'
import { formatInventoryFileSize, inventoryRowSizeBytes } from '~/utils/inventoryPages'

export function buildInventoryPagesCsv(
  pages: OrgInventoryPageRow[],
  options?: { showSiteColumn?: boolean }
): string {
  const headers = options?.showSiteColumn
    ? ['Site', 'Page URL', 'Title', 'Word count', 'Readability score']
    : ['Page URL', 'Title', 'Word count', 'Readability score']

  const rows = pages.map((page) => {
    const cells = [
      page.url,
      page.title ?? '',
      page.word_count != null ? String(page.word_count) : '',
      page.readability_score != null ? String(page.readability_score) : ''
    ]
    if (options?.showSiteColumn) {
      return [page.siteName ?? '—', ...cells]
    }
    return cells
  })

  return buildCsv(headers, rows)
}

export function buildInventoryAssetsCsv(
  assets: OrgInventoryAssetRow[],
  tab: Exclude<OrgInventoryTab, 'pages'>,
  sourceByAsset: Map<string, InventorySourcePageSummary[]>,
  options: {
    includeSubtable: boolean
    showSiteColumn?: boolean
  }
): string {
  const parentHeaders = options.showSiteColumn
    ? ['Site', 'Asset URL', 'MIME type', 'Size']
    : ['Asset URL', 'MIME type', 'Size']

  if (tab === 'pdfs') {
    parentHeaders.push('PDF title')
  }

  const subHeaders = options.includeSubtable
    ? ['Source page URL', 'Source page title']
    : []

  const headers = [...parentHeaders, ...subHeaders]
  const rows: string[][] = []

  for (const asset of assets) {
    const url = String(asset.url ?? '')
    const sizeBytes = inventoryRowSizeBytes(asset)
    const parentCells: string[] = []
    if (options.showSiteColumn) parentCells.push(String(asset.siteName ?? '—'))
    parentCells.push(
      url,
      String(asset.mime_type ?? ''),
      formatInventoryFileSize(sizeBytes)
    )
    if (tab === 'pdfs') {
      parentCells.push(String(asset.pdf_title ?? ''))
    }

    const key = `${asset.siteId ?? ''}:${url.toLowerCase()}`
    const sources = sourceByAsset.get(key) ?? []

    if (!options.includeSubtable || !sources.length) {
      rows.push([...parentCells, ...(options.includeSubtable ? ['', ''] : [])])
      continue
    }

    for (const source of sources) {
      rows.push([
        ...parentCells,
        source.url,
        source.title ?? ''
      ])
    }
  }

  return buildCsv(headers, rows)
}
