import type { PolicyMatch } from '~/types/sitenook'
import { buildCsv } from '~/utils/csvExport'

type PolicyMatchRow = PolicyMatch & { siteName?: string }

export function buildPolicyMatchesCsv(
  items: PolicyMatchRow[],
  options?: { showSiteColumn?: boolean }
): string {
  const headers = options?.showSiteColumn
    ? ['Site', 'Policy', 'Matched Text', 'Context', 'Page URL', 'Severity', 'Category', 'Status']
    : ['Policy', 'Matched Text', 'Context', 'Page URL', 'Severity', 'Category', 'Status']

  const rows = items.map((item) => {
    const cells = [
      item.expand?.policy?.name ?? item.policy,
      item.matched_text,
      item.context,
      item.expand?.page?.url ?? '',
      item.expand?.policy?.severity ?? '',
      item.expand?.policy?.category ?? '',
      item.status
    ]
    if (options?.showSiteColumn) {
      return [item.siteName ?? '—', ...cells]
    }
    return cells
  })

  return buildCsv(headers, rows)
}
