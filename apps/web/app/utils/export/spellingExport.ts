import type { SpellingIssue } from '~/types/sitenook'
import { buildCsv } from '~/utils/csvExport'

type SpellingRow = SpellingIssue & { siteName?: string }

export function buildSpellingCsv(
  items: SpellingRow[],
  options?: { showSiteColumn?: boolean }
): string {
  const headers = options?.showSiteColumn
    ? ['Site', 'Word', 'Context', 'Page URL', 'Confidence']
    : ['Word', 'Context', 'Page URL', 'Confidence']

  const rows = items.map((item) => {
    const cells = [
      item.word,
      item.context,
      item.expand?.page?.url ?? '',
      item.confidence
    ]
    if (options?.showSiteColumn) {
      return [item.siteName ?? '—', ...cells]
    }
    return cells
  })

  return buildCsv(headers, rows)
}
