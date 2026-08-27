import { createSharedComposable } from '@vueuse/core'
import type { AccessibilityIssue, IssueFilters, Scan, WcagLevelFilter } from '~/types/sitenook'
import { latestPageIdsByNormalizedUrl } from '~/utils/pageUrl'
import { pbRelation } from '~/utils/pbFilter'
import type { ElementTotals } from '~/utils/siteimproveScore'
import {
  buildPointsToGainByRule,
  calculateAccessibilityScores,
  calculateAccessibilityScore,
  calculateAccessibilityScoreRaw,
  calculateMarginalPointsToGain,
  calculatePointsToGain,
  formatAccessibilityScore,
  formatPointsToGain,
  scoreableIssues
} from '~/utils/a11yScoring'
import { attachPageMetaToIssues, pageUrlMapFromRows, type A11yPageRow } from '~/utils/a11yPageMeta'
import {
  A11Y_ISSUE_LIST_FIELDS,
  A11Y_PAGE_FIELDS,
  A11Y_SCAN_LIST_FIELDS,
  chunkPageIds,
  pbOrPageIds
} from '~/utils/a11yQueryFields'
import type { A11ySummary } from '~/utils/a11ySummary'
import { createDebouncedReload } from '~/utils/reloadScheduler'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import { pickLatestScan, pickLatestTrustedScan, scanTimestamp } from '~/utils/scanDisplay'
import { parseA11yCheckStats } from '~/utils/a11yCheckStats'
import { issueInSiteTarget, parseSiteSettings, classifyIssueCategory } from '~/utils/siteSettings'

export {
  buildPointsToGainByRule,
  calculateAccessibilityScores,
  calculateAccessibilityScore,
  calculateAccessibilityScoreRaw,
  calculateMarginalPointsToGain,
  calculatePointsToGain,
  formatAccessibilityScore,
  formatPointsToGain
}

function scanActivityTimestamp(scan: Scan): number {
  const raw = scanTimestamp(scan)
  if (!raw) return 0
  const ms = Date.parse(String(raw))
  return Number.isFinite(ms) ? ms : 0
}

/** Most recent scan activity for the site (running scan, or latest completed/started). */
export function pickMostRecentScan(scans: Scan[]): Scan | null {
  return pickLatestScan(scans)
}

function pageActivityTimestamp(page: {
  created?: string
  expand?: { scan?: Scan }
}): number {
  const scan = page.expand?.scan
  if (scan) return scanActivityTimestamp(scan)
  if (page.created) {
    const ms = Date.parse(page.created)
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

function latestPageIdsByUrl(
  pages: Array<{ id: string, url: string, created?: string, expand?: { scan?: Scan } }>
): Set<string> {
  return latestPageIdsByNormalizedUrl(
    pages.map(page => ({
      id: page.id,
      url: page.url,
      ts: pageActivityTimestamp(page)
    }))
  )
}

async function loadIssuesForPageIds(
  pb: ReturnType<typeof usePocketBase>['pb'],
  pageIds: string[]
): Promise<AccessibilityIssue[]> {
  if (!pageIds.length) return []
  const batches = chunkPageIds(pageIds)
  const results = await Promise.all(
    batches.map(batch =>
      pb.collection('accessibility_issues').getFullList({
        filter: pbOrPageIds(batch),
        fields: A11Y_ISSUE_LIST_FIELDS
      })
    )
  )
  return results.flat() as unknown as AccessibilityIssue[]
}

interface SiteAccessibilityState {
  siteId: string
  issues: Ref<AccessibilityIssue[]>
  scans: Ref<Scan[]>
  pagesWithIssuesByScan: Ref<Map<string, number>>
  currentA11y: Ref<A11ySummary | null>
  loading: Ref<boolean>
  pointsToGainByRule: Ref<Map<string, number>>
  fetchSiteData: (options?: { silent?: boolean }) => Promise<void>
  loadSiteIssues: () => Promise<void>
  subscribeScanUpdates: () => Promise<void>
  unsubscribeScanUpdates: () => void
  bumpSubscribeGeneration: () => void
}

function buildSiteAccessibility(siteId: string): SiteAccessibilityState {
  const { sites } = useSites()

  function getPb() {
    const { pb } = usePocketBase()
    if (!pb) {
      throw new Error('PocketBase client is not ready')
    }
    return pb
  }

  const issues = ref<AccessibilityIssue[]>([])
  const scans = ref<Scan[]>([])
  const pagesWithIssuesByScan = ref<Map<string, number>>(new Map())
  const currentA11y = ref<A11ySummary | null>(null)
  const loading = ref(false)
  const pointsToGainByRule = ref<Map<string, number>>(new Map())

  let unsubscribeScans: (() => void) | null = null
  let unsubscribeIssues: (() => void) | null = null
  let unsubscribePages: (() => void) | null = null
  let subscribeGeneration = 0

  const debouncedFetch = createDebouncedReload(
    () => fetchSiteData({ silent: true }),
    400
  )

  function latestCheckStats() {
    const scan = pickLatestTrustedScan(scans.value)
    return parseA11yCheckStats(scan?.a11y_check_stats) ?? scan?.a11y_check_stats
  }

  function recomputePointsToGain() {
    const site = sites.value.find(s => s.id === siteId)
    const totals = site?.score_denominators?.elements
    pointsToGainByRule.value = buildPointsToGainByRule(issues.value, totals, latestCheckStats())
  }

  async function loadSiteIssues() {
    const pb = getPb()
    try {
      const pages = await pb.collection('pages').getFullList({
        filter: pbRelation('site', siteId),
        expand: 'scan',
        fields: A11Y_PAGE_FIELDS
      }) as unknown as A11yPageRow[]

      const allowedPageIds = latestPageIdsByUrl(pages)

      if (!allowedPageIds.size) {
        issues.value = []
        pointsToGainByRule.value = new Map()
        return
      }

      const pageById = pageUrlMapFromRows(pages)
      // Load by scan.site (reliable under org rules) then keep latest-page issues only.
      const allIssues = await pb.collection('accessibility_issues').getFullList({
        filter: pbRelation('scan.site', siteId),
        fields: A11Y_ISSUE_LIST_FIELDS
      }) as unknown as AccessibilityIssue[]

      const latestIssues = allIssues.filter(issue => allowedPageIds.has(issue.page))
      attachPageMetaToIssues(latestIssues, pageById)

      const impactOrder: Record<string, number> = { critical: 4, serious: 3, moderate: 2, minor: 1 }
      issues.value = latestIssues
        .slice()
        .sort((a, b) => (impactOrder[b.impact] || 0) - (impactOrder[a.impact] || 0))

      recomputePointsToGain()
      if (import.meta.dev) {
        console.info(`[useAccessibility] loaded ${issues.value.length} issues for site ${siteId}`)
      }
    } catch (err) {
      console.error('[useAccessibility] loadSiteIssues failed', err)
      issues.value = []
      pointsToGainByRule.value = new Map()
      throw err
    }
  }

  async function loadPagesWithIssuesByScan() {
    const pb = getPb()
    try {
      const scanIssues = await pb.collection('accessibility_issues').getFullList({
        filter: `${pbRelation('scan.site', siteId)} && status = 'open'`,
        fields: 'scan,page'
      }) as Array<{ scan: string, page: string }>

      const pagesByScan = new Map<string, Set<string>>()
      for (const issue of scanIssues) {
        const pages = pagesByScan.get(issue.scan) ?? new Set<string>()
        pages.add(issue.page)
        pagesByScan.set(issue.scan, pages)
      }

      pagesWithIssuesByScan.value = new Map(
        [...pagesByScan.entries()].map(([scanId, pages]) => [scanId, pages.size])
      )
    } catch {
      pagesWithIssuesByScan.value = new Map()
    }
  }

  async function loadCurrentA11ySummary() {
    const pb = getPb()
    try {
      const site = await pb.collection('sites').getOne(siteId, {
        fields: 'current_a11y'
      }) as { current_a11y?: A11ySummary | null }
      currentA11y.value = site.current_a11y ?? null
    } catch {
      currentA11y.value = null
    }
  }

  async function fetchSiteData(options?: { silent?: boolean }) {
    if (!options?.silent) {
      loading.value = true
    }
    try {
      const { awaitAuthReady } = usePocketBase()
      await awaitAuthReady()
      const pb = getPb()
      const results = await Promise.allSettled([
        pb.collection('scans').getFullList({
          filter: pbRelation('site', siteId),
          fields: A11Y_SCAN_LIST_FIELDS
        }),
        loadSiteIssues(),
        loadPagesWithIssuesByScan(),
        loadCurrentA11ySummary()
      ])

      const scanResult = results[0]
      if (scanResult.status === 'fulfilled') {
        scans.value = (scanResult.value as unknown as Scan[]).slice().sort((a, b) =>
          compareTimestampsDesc(
            a.completed_at ?? a.started_at ?? a.created,
            b.completed_at ?? b.started_at ?? b.created
          )
        )
      } else {
        console.error('[useAccessibility] scan load failed', scanResult.reason)
      }

      const issuesResult = results[1]
      if (issuesResult.status === 'rejected') {
        throw issuesResult.reason
      }
    } catch (err) {
      console.error('[useAccessibility] fetchSiteData failed', err)
    } finally {
      if (!options?.silent) {
        loading.value = false
      }
    }
  }

  function unsubscribeScanUpdates() {
    debouncedFetch.cancel()
    if (unsubscribeScans) {
      unsubscribeScans()
      unsubscribeScans = null
    }
    if (unsubscribeIssues) {
      unsubscribeIssues()
      unsubscribeIssues = null
    }
    if (unsubscribePages) {
      unsubscribePages()
      unsubscribePages = null
    }
  }

  async function subscribeScanUpdates() {
    const { awaitAuthReady } = usePocketBase()
    await awaitAuthReady()
    const pb = getPb()
    const generation = ++subscribeGeneration
    unsubscribeScanUpdates()

    try {
      const unsubScans = await pb.collection('scans').subscribe('*', (e) => {
        const record = e.record as { site?: string }
        if (record.site !== siteId) return
        debouncedFetch.schedule()
      })
      if (generation !== subscribeGeneration) {
        unsubScans()
        return
      }
      unsubscribeScans = unsubScans

      const unsubIssues = await pb.collection('accessibility_issues').subscribe('*', (e) => {
        const record = e.record as { site?: string, scan?: string }
        if (record.site === siteId) {
          debouncedFetch.schedule()
          return
        }
        if (record.scan && scans.value.some(s => s.id === record.scan)) {
          debouncedFetch.schedule()
        }
      })
      if (generation !== subscribeGeneration) {
        unsubIssues()
        return
      }
      unsubscribeIssues = unsubIssues

      const unsubPages = await pb.collection('pages').subscribe('*', (e) => {
        const record = e.record as { site?: string }
        if (record.site !== siteId) return
        debouncedFetch.schedule()
      })
      if (generation !== subscribeGeneration) {
        unsubPages()
        return
      }
      unsubscribePages = unsubPages
    } catch {
      // Realtime optional
    }
  }

  function bumpSubscribeGeneration() {
    subscribeGeneration += 1
    unsubscribeScanUpdates()
  }

  return {
    siteId,
    issues,
    scans,
    pagesWithIssuesByScan,
    currentA11y,
    loading,
    pointsToGainByRule,
    fetchSiteData,
    loadSiteIssues,
    subscribeScanUpdates,
    unsubscribeScanUpdates,
    bumpSubscribeGeneration
  }
}

function _useAccessibilityPool() {
  const pools = new Map<string, SiteAccessibilityState>()
  const refCounts = new Map<string, number>()

  function acquire(siteId: string): SiteAccessibilityState {
    if (!pools.has(siteId)) {
      pools.set(siteId, buildSiteAccessibility(siteId))
    }
    refCounts.set(siteId, (refCounts.get(siteId) ?? 0) + 1)
    return pools.get(siteId)!
  }

  function release(siteId: string) {
    const count = (refCounts.get(siteId) ?? 1) - 1
    if (count <= 0) {
      refCounts.delete(siteId)
      const pool = pools.get(siteId)
      if (pool) {
        pool.bumpSubscribeGeneration()
        pools.delete(siteId)
      }
    } else {
      refCounts.set(siteId, count)
    }
  }

  return { acquire, release }
}

const useAccessibilityPool = createSharedComposable(_useAccessibilityPool)

export interface UseAccessibilityOptions {
  /** When false, call `ensureLoaded()` before reads or rely on `fetchSiteData`. */
  eagerLoad?: boolean
}

export function useAccessibility(
  siteId: Ref<string> | string,
  options: UseAccessibilityOptions = {}
) {
  const eagerLoad = options.eagerLoad !== false
  const pool = useAccessibilityPool()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const state = shallowRef<SiteAccessibilityState | null>(null)
  const loadError = ref('')

  let loadGeneration = 0

  async function loadClientSiteData() {
    if (!import.meta.client || !state.value || !id.value) return

    const generation = ++loadGeneration
    loadError.value = ''

    const { awaitAuthReady, pb, syncAuth } = usePocketBase()
    await awaitAuthReady()
    syncAuth()

    if (!pb?.authStore.isValid) {
      loadError.value = 'Your session has expired. Please sign in again.'
      return
    }

    // Ensure token is fresh before large collection reads (avoids racing background refresh).
    try {
      await pb.collection('users').authRefresh()
      syncAuth()
    } catch {
      syncAuth()
      if (!pb.authStore.isValid) {
        loadError.value = 'Your session has expired. Please sign in again.'
        return
      }
    }

    try {
      await state.value.fetchSiteData()
      if (generation !== loadGeneration) return
      void state.value.subscribeScanUpdates()
    } catch (err) {
      if (generation !== loadGeneration) return
      loadError.value = err instanceof Error ? err.message : 'Failed to load accessibility data'
      console.error('[useAccessibility] fetch failed', err)
    }
  }

  watch(id, (newId, oldId) => {
    if (oldId) pool.release(oldId)
    state.value = newId ? pool.acquire(newId) : null
  }, { immediate: true })

  watch(id, () => {
    if (eagerLoad) void loadClientSiteData()
  }, { immediate: eagerLoad })

  async function ensureLoaded() {
    await loadClientSiteData()
  }

  onUnmounted(() => {
    if (id.value) pool.release(id.value)
  })

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

  const { sites } = useSites()

  const siteSettings = computed(() => {
    const site = sites.value.find(s => s.id === id.value)
    return parseSiteSettings(site?.site_settings, site?.default_scan_config)
  })

  const siteTargetIssues = computed(() =>
    (state.value?.issues.value ?? []).filter(issue => issueInSiteTarget(issue, siteSettings.value))
  )

  const mostRecentScan = computed(() => pickMostRecentScan(state.value?.scans.value ?? []))

  const levelCounts = computed(() => ({
    All: siteTargetIssues.value.filter(i => i.status !== 'dismissed').length,
    A: siteTargetIssues.value.filter(i => i.wcag_level === 'A' && i.status !== 'dismissed').length,
    AA: siteTargetIssues.value.filter(i => i.wcag_level === 'AA' && i.status !== 'dismissed').length,
    AAA: siteTargetIssues.value.filter(i => i.wcag_level === 'AAA' && i.status !== 'dismissed').length
  }))

  const filteredIssues = computed(() => {
    return siteTargetIssues.value.filter((issue) => {
      const levelFilter = filters.value.wcagLevels.length
        ? filters.value.wcagLevels
        : (wcagLevel.value !== 'All' ? [wcagLevel.value] : [])
      if (levelFilter.length && !levelFilter.includes(issue.wcag_level)) return false
      if (filters.value.targetCategories.length) {
        if (!filters.value.targetCategories.includes(classifyIssueCategory(issue))) return false
      }
      if (filters.value.wcagVersions.length && issue.wcag_version && !filters.value.wcagVersions.includes(issue.wcag_version)) return false
      if (filters.value.impacts.length) {
        const allowed = new Set(filters.value.impacts)
        if (allowed.has('critical')) allowed.add('serious')
        if (!allowed.has(issue.impact)) return false
      }
      if (filters.value.types.length && !filters.value.types.includes(issue.type)) return false
      if (filters.value.elements.length && issue.element_type && !filters.value.elements.includes(issue.element_type)) return false
      if (filters.value.roles.length && issue.responsible_role && !filters.value.roles.includes(issue.responsible_role)) return false
      if (filters.value.statuses.length && !filters.value.statuses.includes(issue.status)) return false
      return true
    })
  })

  const scoreableTargetIssues = computed(() => scoreableIssues(siteTargetIssues.value))

  const cachedElementTotals = computed(() => {
    const site = sites.value.find(s => s.id === id.value)
    return site?.score_denominators?.elements
  })

  const scoringCheckStats = computed(() => {
    const scan = pickLatestTrustedScan(state.value?.scans.value ?? [])
    return parseA11yCheckStats(scan?.a11y_check_stats) ?? scan?.a11y_check_stats ?? null
  })

  const accessibilityScores = computed(() =>
    calculateAccessibilityScores(
      scoreableTargetIssues.value,
      cachedElementTotals.value,
      scoringCheckStats.value
    )
  )

  const overallScore = computed(() => accessibilityScores.value.overall)

  const levelScores = computed(() => ({
    a: accessibilityScores.value.levelA,
    aa: accessibilityScores.value.levelAA,
    aaa: accessibilityScores.value.levelAAA
  }))

  const compositeScore = computed(() =>
    calculateAccessibilityScores(
      scoreableIssues(filteredIssues.value),
      cachedElementTotals.value,
      scoringCheckStats.value
    ).overall
  )

  return {
    issues: computed(() => state.value?.issues.value ?? []),
    scans: computed(() => state.value?.scans.value ?? []),
    pagesWithIssuesByScan: computed(() => state.value?.pagesWithIssuesByScan.value ?? new Map()),
    currentA11y: computed(() => state.value?.currentA11y.value ?? null),
    pointsToGainByRule: computed(() => state.value?.pointsToGainByRule.value ?? new Map()),
    mostRecentScan,
    loading: computed(() => state.value?.loading.value ?? false),
    loadError,
    wcagLevel,
    filters,
    siteSettings,
    siteTargetIssues,
    levelCounts,
    filteredIssues,
    overallScore,
    levelScores,
    scoreElementTotals: cachedElementTotals,
    scoringCheckStats,
    scoreableTargetIssues,
    compositeScore,
    fetchSiteData: (options?: { silent?: boolean }) =>
      state.value?.fetchSiteData(options) ?? Promise.resolve(),
    loadSiteIssues: () => state.value?.loadSiteIssues() ?? Promise.resolve(),
    ensureLoaded
  }
}
