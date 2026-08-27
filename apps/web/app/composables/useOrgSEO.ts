import type { SeoIssue } from '~/types/sitenook'
import { orgApiFetch } from '~/utils/orgApiFetch'

export interface OrgSeoIssueRow extends SeoIssue {
  siteId: string
  siteName: string
}

interface OrgListResponse<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

export function useOrgSEO(siteFilter: Ref<string | undefined>) {
  const issues = ref<OrgSeoIssueRow[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(50)
  let fetchGeneration = 0

  async function fetchIssues(category: 'technical' | 'content') {
    const generation = ++fetchGeneration
    loading.value = true
    try {
      const result = await orgApiFetch<OrgListResponse<OrgSeoIssueRow>>('/api/org/seo/issues', {
        page: page.value,
        perPage: perPage.value,
        siteId: siteFilter.value,
        category
      })
      if (generation !== fetchGeneration) return
      issues.value = result.items
      total.value = result.total
    } finally {
      if (generation === fetchGeneration) {
        loading.value = false
      }
    }
  }

  onUnmounted(() => {
    fetchGeneration++
    issues.value = []
    total.value = 0
  })

  return { issues, loading, total, page, perPage, fetchIssues }
}
