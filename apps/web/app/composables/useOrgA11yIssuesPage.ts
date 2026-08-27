import type { AccessibilityIssue, IssueFilters, WcagLevelFilter } from '~/types/sitenook'
import type { A11yIssuesApiResponse } from '~/composables/useA11yIssuesPage'
import type { AffectedPageSummary } from '~/utils/affectedPages'
import type { A11yRuleStats } from '~/composables/useA11yIssuesPage'
import { watchDebounced } from '@vueuse/core'
import type { OrgAccessibilityIssueRow } from '~/composables/useOrgAccessibilityIssues'
import { orgApiFetch } from '~/utils/orgApiFetch'

const AFFECTED_PAGES_FAILURE_TTL_MS = 15_000

function affectedPagesKey(siteId: string, ruleId: string) {
  return `${siteId}:${ruleId}`
}

function pocketBaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const fetchError = error as {
      data?: { message?: string, statusMessage?: string }
      statusMessage?: string
      message?: string
    }
    if (fetchError.data?.statusMessage) return fetchError.data.statusMessage
    if (fetchError.data?.message) return fetchError.data.message
    if (fetchError.statusMessage) return fetchError.statusMessage
    if (fetchError.message) return fetchError.message
  }
  return 'Failed to load issues'
}

export function useOrgA11yIssuesPage() {
  const { pb, awaitAuthReady } = usePocketBase()
  const { resolvedSiteId, isAllSites } = useWorkspaceSiteFilter()

  const wcagLevel = useState<WcagLevelFilter>('org-a11y-wcag-level', () => 'All')
  const filters = useState<IssueFilters>('org-a11y-filters', () => ({
    wcagVersions: [],
    wcagLevels: [],
    targetCategories: [],
    impacts: [],
    types: [],
    elements: [],
    roles: [],
    statuses: ['open']
  }))

  const items = ref<OrgAccessibilityIssueRow[]>([])
  const loading = ref(false)
  const error = ref('')
  const total = ref(0)
  const page = ref(1)
  const perPage = ref(20)
  const openUniqueCount = ref(0)
  const openOccurrencesCount = ref(0)
  const occurrencesCount = ref(0)
  const pointsToGainByRule = ref<Map<string, number>>(new Map())
  const ruleStats = ref<Map<string, A11yRuleStats>>(new Map())
  const tableSearch = ref('')
  const affectedPagesCache = ref<Map<string, AffectedPageSummary[]>>(new Map())
  const affectedPagesLoading = ref<Set<string>>(new Set())
  const affectedPagesInFlight = new Map<string, Promise<AffectedPageSummary[]>>()
  const affectedPagesFailureUntil = new Map<string, number>()

  let fetchGeneration = 0
  let skipPageWatch = false

  function getAffectedPagesForRule(ruleId: string, siteId?: string) {
    if (!siteId) return []
    return affectedPagesCache.value.get(affectedPagesKey(siteId, ruleId)) ?? []
  }

  async function loadAffectedPagesForRule(ruleId: string, siteId?: string): Promise<AffectedPageSummary[]> {
    if (!import.meta.client || !ruleId || !siteId) return []
    const key = affectedPagesKey(siteId, ruleId)
    const cached = affectedPagesCache.value.get(key)
    if (cached) return cached

    const failureUntil = affectedPagesFailureUntil.get(key) ?? 0
    if (failureUntil > Date.now()) return []

    const inFlight = affectedPagesInFlight.get(key)
    if (inFlight) return inFlight

    const promise = (async (): Promise<AffectedPageSummary[]> => {
      await awaitAuthReady()
      const token = pb?.authStore.token
      if (!token) return []

      affectedPagesLoading.value = new Set(affectedPagesLoading.value).add(key)
      try {
        const response = await $fetch<{ pages: AffectedPageSummary[] }>(
          `/api/sites/${siteId}/accessibility/issues/${encodeURIComponent(ruleId)}/pages`,
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 60_000
          }
        )
        const pages = response.pages ?? []
        affectedPagesCache.value = new Map(affectedPagesCache.value).set(key, pages)
        affectedPagesFailureUntil.delete(key)
        return pages
      } catch {
        affectedPagesFailureUntil.set(key, Date.now() + AFFECTED_PAGES_FAILURE_TTL_MS)
        return []
      } finally {
        const next = new Set(affectedPagesLoading.value)
        next.delete(key)
        affectedPagesLoading.value = next
        affectedPagesInFlight.delete(key)
      }
    })()

    affectedPagesInFlight.set(key, promise)
    return promise
  }

  function isAffectedPagesLoading(ruleId: string, siteId?: string) {
    if (!siteId) return false
    return affectedPagesLoading.value.has(affectedPagesKey(siteId, ruleId))
  }

  function invalidateAffectedPagesForRule(ruleId: string, siteId?: string) {
    if (!siteId) return
    const key = affectedPagesKey(siteId, ruleId)
    const next = new Map(affectedPagesCache.value)
    next.delete(key)
    affectedPagesCache.value = next
    affectedPagesFailureUntil.delete(key)
    affectedPagesInFlight.delete(key)
  }

  function buildQueryParams() {
    const levelFilter = filters.value.wcagLevels.length
      ? filters.value.wcagLevels
      : (wcagLevel.value !== 'All' ? [wcagLevel.value] : [])

    return {
      page: page.value,
      perPage: perPage.value,
      siteId: resolvedSiteId.value,
      search: tableSearch.value.trim() || undefined,
      wcagLevels: levelFilter.length ? levelFilter.join(',') : undefined,
      impacts: filters.value.impacts.length ? filters.value.impacts.join(',') : undefined,
      types: filters.value.types.length ? filters.value.types.join(',') : undefined,
      elements: filters.value.elements.length ? filters.value.elements.join(',') : undefined,
      roles: filters.value.roles.length ? filters.value.roles.join(',') : undefined,
      targetCategories: filters.value.targetCategories.length
        ? filters.value.targetCategories.join(',')
        : undefined,
      statuses: filters.value.statuses.length ? filters.value.statuses.join(',') : undefined
    }
  }

  async function fetchIssues(options?: { silent?: boolean }) {
    if (!import.meta.client) return

    const generation = ++fetchGeneration
    if (!options?.silent) loading.value = true
    error.value = ''

    try {
      const response = await orgApiFetch<
        A11yIssuesApiResponse & { items: OrgAccessibilityIssueRow[] }
      >('/api/org/accessibility/issues', buildQueryParams())

      if (generation !== fetchGeneration) return

      items.value = response.items
      total.value = response.total
      page.value = response.page
      perPage.value = response.perPage
      openUniqueCount.value = response.openUniqueCount
      openOccurrencesCount.value = response.openOccurrencesCount
      occurrencesCount.value = response.occurrencesCount ?? response.openOccurrencesCount
      pointsToGainByRule.value = new Map(Object.entries(response.pointsToGainByRule ?? {}))
      ruleStats.value = new Map(Object.entries(response.ruleStats ?? {}))
    } catch (e: unknown) {
      if (generation !== fetchGeneration) return
      error.value = pocketBaseErrorMessage(e)
      items.value = []
      total.value = 0
    } finally {
      if (generation === fetchGeneration && !options?.silent) {
        loading.value = false
      }
    }
  }

  function resetPageAndFetch() {
    if (page.value !== 1) {
      skipPageWatch = true
      page.value = 1
      skipPageWatch = false
    }
    fetchIssues().catch(() => {})
  }

  watch([page, perPage], () => {
    if (skipPageWatch) return
    fetchIssues().catch(() => {})
  })

  watch(filters, () => {
    resetPageAndFetch()
  }, { deep: true })

  watch(wcagLevel, () => {
    resetPageAndFetch()
  })

  watchDebounced(tableSearch, () => {
    resetPageAndFetch()
  }, { debounce: 300 })

  watch([resolvedSiteId, isAllSites], () => {
    affectedPagesCache.value = new Map()
    affectedPagesFailureUntil.clear()
    affectedPagesInFlight.clear()
    resetPageAndFetch()
  })

  onMounted(() => {
    fetchIssues().catch(() => {})
  })

  return {
    items,
    loading,
    error,
    total,
    page,
    perPage,
    wcagLevel,
    filters,
    tableSearch,
    openUniqueCount,
    openOccurrencesCount,
    occurrencesCount,
    pointsToGainByRule,
    ruleStats,
    fetchIssues,
    isAllSites,
    getAffectedPagesForRule,
    loadAffectedPagesForRule,
    isAffectedPagesLoading,
    invalidateAffectedPagesForRule,
    buildQueryParams
  }
}
