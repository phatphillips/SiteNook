import type { BrokenLink } from '~/types/sitenook'
import { buildCsv } from '~/utils/csvExport'

type BrokenLinkRow = BrokenLink & { siteName?: string }

export function buildBrokenLinksCsv(
  links: BrokenLinkRow[],
  view: 'links' | 'pages',
  options?: { showSiteColumn?: boolean }
): string {
  if (view === 'pages') {
    const map = new Map<string, { url: string, count: number, siteName: string }>()
    for (const link of links) {
      const pageUrl = link.expand?.page?.url || link.page
      const existing = map.get(pageUrl) ?? {
        url: pageUrl,
        count: 0,
        siteName: link.siteName ?? '—'
      }
      existing.count++
      map.set(pageUrl, existing)
    }
    const headers = options?.showSiteColumn
      ? ['Site', 'Page URL', 'Broken links']
      : ['Page URL', 'Broken links']
    const rows = [...map.values()]
      .sort((a, b) => b.count - a.count)
      .map(row => options?.showSiteColumn
        ? [row.siteName, row.url, String(row.count)]
        : [row.url, String(row.count)])
    return buildCsv(headers, rows)
  }

  const headers = options?.showSiteColumn
    ? ['Site', 'Link URL', 'Status code', 'Type', 'Status', 'Found on page']
    : ['Link URL', 'Status code', 'Type', 'Status', 'Found on page']

  const rows = links.map((link) => {
    const cells = [
      link.href,
      String(link.status_code),
      link.link_type,
      link.status,
      link.expand?.page?.url || link.page
    ]
    if (options?.showSiteColumn) {
      return [link.siteName ?? '—', ...cells]
    }
    return cells
  })

  return buildCsv(headers, rows)
}
