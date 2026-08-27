import type { AccessibilityIssue } from '~/types/sitenook'
import type { A11yIssuesApiResponse } from '~/composables/useA11yIssuesPage'
import { orgApiFetch } from '~/utils/orgApiFetch'

export interface OrgAccessibilityIssueRow extends AccessibilityIssue {
  siteId: string
  siteName: string
}

export function useOrgAccessibilityIssues(siteFilter: Ref<string | undefined>) {
  const items = ref<OrgAccessibilityIssueRow[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(20)

  async function fetchIssues(query?: Record<string, string | number | undefined>) {
    loading.value = true
    try {
      const result = await orgApiFetch<A11yIssuesApiResponse & { items: OrgAccessibilityIssueRow[] }>(
        '/api/org/accessibility/issues',
        {
          page: page.value,
          perPage: perPage.value,
          siteId: siteFilter.value,
          ...query
        }
      )
      items.value = result.items
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  return { items, loading, total, page, perPage, fetchIssues }
}
