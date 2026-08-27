import type { ReadabilityPageRow } from '~/utils/readabilityMethods'
import type { ReadabilityMethodId } from '~/utils/readabilityMethods'
import { orgApiFetch } from '~/utils/orgApiFetch'

export interface OrgReadabilityPageRow extends ReadabilityPageRow {
  siteId: string
  siteName: string
}

interface OrgListResponse<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

interface OrgReadabilitySummaryResponse {
  pages: ReadabilityPageRow[]
}

export function useOrgReadability(siteFilter: Ref<string | undefined>) {
  const pages = ref<OrgReadabilityPageRow[]>([])
  const summaryPages = ref<ReadabilityPageRow[]>([])
  const loading = ref(false)
  const summaryLoading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(20)
  const selectedMethodId = ref<ReadabilityMethodId | null>(null)
  const selectedBucketId = ref<string | null>(null)
  let pagesGeneration = 0
  let summaryGeneration = 0

  async function fetchSummary() {
    const generation = ++summaryGeneration
    summaryLoading.value = true
    try {
      const result = await orgApiFetch<OrgReadabilitySummaryResponse>('/api/org/readability/summary', {
        siteId: siteFilter.value
      })
      if (generation !== summaryGeneration) return
      summaryPages.value = result.pages
    } finally {
      if (generation === summaryGeneration) {
        summaryLoading.value = false
      }
    }
  }

  async function fetchPages() {
    const generation = ++pagesGeneration
    loading.value = true
    try {
      const result = await orgApiFetch<OrgListResponse<OrgReadabilityPageRow>>('/api/org/readability/pages', {
        page: page.value,
        perPage: perPage.value,
        siteId: siteFilter.value,
        methodId: selectedMethodId.value ?? undefined,
        bucketId: selectedBucketId.value ?? undefined
      })
      if (generation !== pagesGeneration) return
      pages.value = result.items
      total.value = result.total
    } finally {
      if (generation === pagesGeneration) {
        loading.value = false
      }
    }
  }

  async function fetchAll() {
    await Promise.all([fetchSummary(), fetchPages()])
  }

  return {
    pages,
    summaryPages,
    loading,
    summaryLoading,
    total,
    page,
    perPage,
    selectedMethodId,
    selectedBucketId,
    fetchPages,
    fetchSummary,
    fetchAll
  }
}
