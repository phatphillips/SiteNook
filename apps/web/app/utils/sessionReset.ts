import type { HistoryStatusFilter, IssueFilters, WcagLevelFilter } from '~/types/accessiq'

/** Drop in-memory caches when the signed-in user changes (login/logout/account switch). */
export function resetAppSessionState() {
  if (import.meta.server) return

  useSites().resetSession()
  useScans().resetSession()
  useTeamMembers().resetSession()

  useState<string | null>('active-site-id').value = null
  useState<string | null>('scans-site-filter').value = null
  useState<HistoryStatusFilter>('scans-status-filter').value = 'all'
  useState<string | null>('scans-expanded-site-id').value = null
  useState<WcagLevelFilter>('a11y-wcag-level').value = 'All'
  useState<IssueFilters>('a11y-filters').value = {
    wcagVersions: [],
    wcagLevels: [],
    targetCategories: [],
    impacts: [],
    types: [],
    elements: [],
    roles: [],
    statuses: ['open']
  }
}
