import type { BrokenLink, PolicyMatch, SpellingIssue } from '~/types/sitenook'
import { orgApiFetch } from '~/utils/orgApiFetch'

export interface OrgBrokenLinkRow extends BrokenLink {
  siteId: string
  siteName: string
}

export interface OrgSpellingRow extends SpellingIssue {
  siteId: string
  siteName: string
}

export interface OrgPolicyMatchRow extends PolicyMatch {
  siteId: string
  siteName: string
}

interface OrgListResponse<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

export function useOrgQA(siteFilter: Ref<string | undefined>) {
  const brokenLinks = ref<OrgBrokenLinkRow[]>([])
  const spelling = ref<OrgSpellingRow[]>([])
  const policyMatches = ref<OrgPolicyMatchRow[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(20)
  let fetchGeneration = 0

  async function fetchBrokenLinks(options?: { hrefQuery?: string }) {
    const generation = ++fetchGeneration
    loading.value = true
    try {
      const result = await orgApiFetch<OrgListResponse<OrgBrokenLinkRow>>('/api/org/qa/broken-links', {
        page: page.value,
        perPage: perPage.value,
        siteId: siteFilter.value,
        hrefQuery: options?.hrefQuery
      })
      if (generation !== fetchGeneration) return
      brokenLinks.value = result.items
      total.value = result.total
    } finally {
      if (generation === fetchGeneration) {
        loading.value = false
      }
    }
  }

  async function fetchSpelling(options?: { confidence?: 'error' | 'review' }) {
    const generation = ++fetchGeneration
    loading.value = true
    try {
      const result = await orgApiFetch<OrgListResponse<OrgSpellingRow>>('/api/org/qa/spelling', {
        page: page.value,
        perPage: perPage.value,
        siteId: siteFilter.value,
        confidence: options?.confidence
      })
      if (generation !== fetchGeneration) return
      spelling.value = result.items
      total.value = result.total
    } finally {
      if (generation === fetchGeneration) {
        loading.value = false
      }
    }
  }

  async function fetchPolicyMatches(options?: { status?: 'open' | 'dismissed' | 'fixed' }) {
    const generation = ++fetchGeneration
    loading.value = true
    try {
      const result = await orgApiFetch<OrgListResponse<OrgPolicyMatchRow>>('/api/org/qa/policy-matches', {
        page: page.value,
        perPage: perPage.value,
        siteId: siteFilter.value,
        status: options?.status
      })
      if (generation !== fetchGeneration) return
      policyMatches.value = result.items
      total.value = result.total
    } finally {
      if (generation === fetchGeneration) {
        loading.value = false
      }
    }
  }

  return {
    brokenLinks,
    spelling,
    policyMatches,
    loading,
    total,
    page,
    perPage,
    fetchBrokenLinks,
    fetchSpelling,
    fetchPolicyMatches
  }
}
