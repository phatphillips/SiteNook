import type { AccessibilityIssue, IssueFilters, Scan, WcagLevelFilter } from '~/types/accessiq'
import type { A11ySummary } from '~/utils/a11ySummary'
import type { ElementTotals } from '~/utils/siteimproveScore'
import type { AffectedPageSummary } from '~/utils/affectedPages'

export interface A11yRuleStats {
  pages: number
  occurrences: number
}

export interface A11yIssuesApiResponse {
  items: AccessibilityIssue[]
  total: number
  page: number
  perPage: number
  openUniqueCount: number
  openOccurrencesCount: number
  occurrencesCount: number
  pointsToGainByRule: Record<string, number>
  ruleStats: Record<string, A11yRuleStats>
  currentA11y: A11ySummary | null
  source?: 'summary' | 'full'
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

export function useA11yIssuesPage(siteId: Ref<string> | string) {
  const { pb, awaitAuthReady } = usePocketBase()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const wcagLevel = useState<WcagLevelFilter>('a11y-wcag-level', () => 'All')
  const filters = useState<IssueFilters>('a11y-filters', () => ({
    wcagVersions: [],
    wcagLevels: [],
    targetCategories: [],
    impacts: [],
    types: [],
    elements: [],
    roles: [],
    statuses: ['open']
  }))

  const items = ref<AccessibilityIssue[]>([])
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
  const scoreElementTotals = ref<ElementTotals | undefined>(undefined)
  const currentA11y = ref<A11ySummary | null>(null)
  const scans = ref<Scan[]>([])
  const tableSearch = ref('')
  const affectedPagesCache = ref<Map<string, AffectedPageSummary[]>>(new Map())
  const affectedPagesLoading = ref<Set<string>>(new Set())

  const pointsToGainMap = computed(() => pointsToGainByRule.value)

  function getAffectedPagesForRule(ruleId: string) {
    return affectedPagesCache.value.get(ruleId) ?? []
  }

  async function loadAffectedPagesForRule(ruleId: string): Promise<AffectedPageSummary[]> {
    if (!import.meta.client || !id.value || !ruleId) return []
    const cached = affectedPagesCache.value.get(ruleId)
    if (cached) return cached
    if (affectedPagesLoading.value.has(ruleId)) return []

    await awaitAuthReady()
    const token = pb?.authStore.token
    if (!token) return []

    affectedPagesLoading.value.add(ruleId)
    try {
      const response = await $fetch<{ pages: AffectedPageSummary[] }>(
        `/api/sites/${id.value}/accessibility/issues/${encodeURIComponent(ruleId)}/pages`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60_000
        }
      )
      const pages = response.pages ?? []
      affectedPagesCache.value = new Map(affectedPagesCache.value).set(ruleId, pages)
      return pages
    } catch {
      return []
    } finally {
      affectedPagesLoading.value.delete(ruleId)
    }
  }

  function buildQueryParams() {
    const levelFilter = filters.value.wcagLevels.length
      ? filters.value.wcagLevels
      : (wcagLevel.value !== 'All' ? [wcagLevel.value] : [])

    return {
      page: page.value,
      perPage: perPage.value,
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

  let fetchGeneration = 0

  async function fetchIssues(options?: { silent?: boolean }) {
    if (!import.meta.client || !id.value) return

    const generation = ++fetchGeneration
    await awaitAuthReady()

    const token = pb?.authStore.token
    if (!token) {
      error.value = 'Your session has expired. Please sign in again.'
      loading.value = false
      return
    }

    if (!options?.silent) loading.value = true
    error.value = ''
    try {
      const response = await $fetch<A11yIssuesApiResponse>(
        `/api/sites/${id.value}/accessibility/issues`,
        {
          headers: { Authorization: `Bearer ${token}` },
          query: buildQueryParams(),
          timeout: 120_000
        }
      )

      if (generation !== fetchGeneration) return

      items.value = response.items
      total.value = response.total
      page.value = response.page
      perPage.value = response.perPage
      openUniqueCount.value = response.openUniqueCount
      openOccurrencesCount.value = response.openOccurrencesCount
      occurrencesCount.value = response.occurrencesCount ?? response.openOccurrencesCount
      pointsToGainByRule.value = new Map(Object.entries(response.pointsToGainByRule))
      ruleStats.value = new Map(Object.entries(response.ruleStats ?? {}))
      currentA11y.value = response.currentA11y ?? null
      affectedPagesCache.value = new Map()

      if (import.meta.dev) {
        console.info(
          `[useA11yIssuesPage] loaded ${response.items.length} issue types (${response.openOccurrencesCount} in site target, source=${response.source ?? 'unknown'}) for site ${id.value}`
        )
      }
    } catch (e: unknown) {
      if (generation !== fetchGeneration) return
      error.value = pocketBaseErrorMessage(e)
      items.value = []
      total.value = 0
      console.error('[useA11yIssuesPage] fetch failed', e)
    } finally {
      if (generation === fetchGeneration && !options?.silent) {
        loading.value = false
      }
    }
  }

  async function loadOverviewMeta() {
    if (!import.meta.client || !id.value) return
    await awaitAuthReady()
    const token = pb?.authStore.token
    if (!token) return

    try {
      const overview = await $fetch<{
        scans: Scan[]
        scoreDenominators?: { elements?: ElementTotals }
        currentA11y?: A11ySummary | null
      }>(`/api/sites/${id.value}/accessibility/overview`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60_000
      })
      scans.value = overview.scans
      scoreElementTotals.value = overview.scoreDenominators?.elements
      if (overview.currentA11y) {
        currentA11y.value = overview.currentA11y
      }
    } catch {
      // Non-fatal
    }
  }

  async function refreshAll(options?: { silent?: boolean }) {
    await Promise.all([
      fetchIssues(options),
      loadOverviewMeta()
    ])
  }

  watch([page, perPage], () => {
    fetchIssues({ silent: true }).catch(() => {})
  })

  watch(filters, () => {
    page.value = 1
    fetchIssues().catch(() => {})
  }, { deep: true })

  watch(wcagLevel, () => {
    page.value = 1
    fetchIssues().catch(() => {})
  })

  watch(id, () => {
    page.value = 1
    affectedPagesCache.value = new Map()
    refreshAll().catch(() => {})
  }, { immediate: true })

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
    pointsToGainByRule: pointsToGainMap,
    ruleStats,
    scoreElementTotals,
    currentA11y,
    scans,
    getAffectedPagesForRule,
    loadAffectedPagesForRule,
    fetchIssues,
    refreshAll
  }
}

export { reconcileSiteA11ySummary as reconcileCurrentA11y } from '~/utils/a11yReconcile'
