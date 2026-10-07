import { createSharedComposable } from '@vueuse/core'
import type {
  ActiveScanRow,
  HistoryStatusFilter,
  PageRecord,
  Scan,
  ScanQueueItem,
  Site
} from '~/types/sitenook'
import { pbOr, pbRelation, pbSelect } from '~/utils/pbFilter'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import { deriveScanType, parseScanConfig, serializeScanConfig } from '~/utils/scanConfig'
import {
  buildLatestCompleteScanMap,
  scanTimestamp,
  TERMINAL_SCAN_STATUSES
} from '~/utils/scanDisplay'

const HISTORY_PAGE_SIZE = 20
const SITE_SCANS_PAGE_SIZE = 50
const ACTIVE_FETCH_TIMEOUT_MS = 25_000
const ACTIVE_LIST_PAGE_SIZE = 100

function withFetchTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ACTIVE_FETCH_TIMEOUT_MS}ms`)),
        ACTIVE_FETCH_TIMEOUT_MS
      )
    })
  ])
}

export function buildLatestScanMap(scans: Scan[]): Map<string, Scan> {
  const sorted = [...scans].sort((a, b) =>
    compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b))
  )
  const map = new Map<string, Scan>()
  for (const scan of sorted) {
    if (!map.has(scan.site)) map.set(scan.site, scan)
  }
  return map
}

export function buildSiteFilterClause(siteId: string | null | undefined): string {
  if (!siteId) return ''
  return ` && ${pbRelation('site', siteId)}`
}

export function buildHistoryFilter(
  siteId: string | null | undefined,
  statusFilter: HistoryStatusFilter
): string {
  let statusClause: string
  if (statusFilter === 'complete') {
    statusClause = pbOr([
      pbSelect('status', 'complete'),
      pbSelect('status', 'complete_with_errors')
    ])
  } else if (statusFilter === 'failed') {
    statusClause = pbOr([
      pbSelect('status', 'failed'),
      pbSelect('status', 'cancelled')
    ])
  } else {
    statusClause = pbOr(
      TERMINAL_SCAN_STATUSES.map(status => pbSelect('status', status))
    )
  }
  return statusClause + buildSiteFilterClause(siteId)
}

export function buildActiveQueueFilter(siteId: string | null | undefined): string {
  const statusClause = pbOr([
    pbSelect('status', 'pending'),
    pbSelect('status', 'processing')
  ])
  return statusClause + buildSiteFilterClause(siteId)
}

export function buildActiveScansFilter(siteId: string | null | undefined): string {
  return pbOr([
    pbSelect('status', 'running'),
    pbSelect('status', 'background_scan')
  ]) + buildSiteFilterClause(siteId)
}

function siteNameFromExpand(
  expand: { site?: Pick<Site, 'name' | 'url'> } | undefined,
  siteId: string,
  siteList: Site[]
): string {
  return expand?.site?.name || siteList.find(s => s.id === siteId)?.name || 'Unknown site'
}

function siteUrlFromExpand(
  expand: { site?: Pick<Site, 'url'> } | undefined,
  siteId: string,
  siteList: Site[]
): string {
  return expand?.site?.url || siteList.find(s => s.id === siteId)?.url || ''
}

function queueToActiveRow(item: ScanQueueItem, siteList: Site[]): ActiveScanRow {
  return {
    id: `queue-${item.id}`,
    recordId: item.id,
    siteId: item.site,
    siteName: siteNameFromExpand(item.expand, item.site, siteList),
    siteUrl: siteUrlFromExpand(item.expand, item.site, siteList),
    scanType: item.scan_type || 'full',
    status: item.status,
    source: 'queue',
    timestamp: String(item.created ?? ''),
    rawConfig: item.raw_config ?? null
  }
}

function scanToActiveRow(scan: Scan, siteList: Site[]): ActiveScanRow {
  return {
    id: `scan-${scan.id}`,
    recordId: scan.id,
    siteId: scan.site,
    siteName: siteNameFromExpand(scan.expand, scan.site, siteList),
    siteUrl: siteUrlFromExpand(scan.expand, scan.site, siteList),
    scanType: scan.scan_type || 'full',
    status: scan.status,
    source: 'scan',
    pagesCrawled: scan.pages_crawled,
    timestamp: String(scan.started_at ?? scan.created ?? ''),
    rawConfig: scan.raw_config ?? null
  }
}

function pocketBaseErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: string }).message)
  }
  return 'Request failed'
}

function logQueryError(scope: string, e: unknown) {
  console.warn(`[useScans] ${scope} failed`, e)
}

function _useScans() {
  const { pb, awaitAuthReady, syncAuth } = usePocketBase()
  const { sites, fetchSites, queueScanWithConfig } = useSites()

  const siteFilter = useState<string | null>('scans-site-filter', () => null)
  const statusFilter = useState<HistoryStatusFilter>('scans-status-filter', () => 'all')

  const activeQueue = ref<ScanQueueItem[]>([])
  const activeScans = ref<Scan[]>([])
  const historyScans = ref<Scan[]>([])
  const historyPage = ref(1)
  const historyTotal = ref(0)

  const activeLoading = ref(false)
  const hasFetchedActiveOnce = ref(false)
  const historyLoading = ref(false)
  const error = ref('')

  const latestScansRaw = ref<Scan[]>([])
  const scansBySite = ref<Map<string, Scan[]>>(new Map())
  const pagesByScan = ref<Map<string, PageRecord[]>>(new Map())
  const siteScansLoading = ref<Set<string>>(new Set())
  const siteScansLoaded = ref<Set<string>>(new Set())
  const scanPagesLoading = ref<Set<string>>(new Set())
  const expandedSiteId = useState<string | null>('scans-expanded-site-id', () => null)

  const latestScanBySiteId = computed(() => buildLatestScanMap(latestScansRaw.value))
  const latestCompleteScanBySiteId = computed(() =>
    buildLatestCompleteScanMap(latestScansRaw.value)
  )

  const rescanModalOpen = ref(false)
  const rescanSite = ref<Site | null>(null)
  const rescanRawConfig = ref<Record<string, unknown> | null>(null)

  const activeRows = computed<ActiveScanRow[]>(() => {
    const runningSiteIds = new Set(
      activeScans.value
        .filter(s => s.status === 'running' || s.status === 'background_scan')
        .map(s => s.site)
    )
    // Queue stays "processing" while the worker runs a `scans` row. Show one row per job.
    const siteList = sites.value
    const queueRows = activeQueue.value
      .filter(item => !(item.status === 'processing' && runningSiteIds.has(item.site)))
      .map(item => queueToActiveRow(item, siteList))
    const rows = [...queueRows, ...activeScans.value.map(s => scanToActiveRow(s, siteList))]
    return rows.slice().sort((a, b) => compareTimestampsDesc(a.timestamp, b.timestamp))
  })

  const historyPageCount = computed(() =>
    Math.max(1, Math.ceil(historyTotal.value / HISTORY_PAGE_SIZE))
  )

  const filteredSiteId = computed(() => siteFilter.value || undefined)

  function isSiteBusy(siteId: string): boolean {
    const queueBusy = activeQueue.value.some(
      item => item.site === siteId && (item.status === 'pending' || item.status === 'processing')
    )
    const scanBusy = activeScans.value.some(
      scan =>
        scan.site === siteId
        && (scan.status === 'running' || scan.status === 'background_scan')
    )
    return queueBusy || scanBusy
  }

  async function cancelRunningScan(scanId: string): Promise<void> {
    const now = new Date().toISOString()
    try {
      await pb.collection('scans').update(scanId, {
        status: 'cancelled',
        completed_at: now,
        background_retry: null
      })
    } catch {
      await pb.collection('scans').update(scanId, {
        status: 'failed',
        completed_at: now,
        background_retry: null
      })
    }
  }

  async function cancelQueueItem(row: ActiveScanRow): Promise<void> {
    if (row.status === 'pending') {
      try {
        await pb.collection('scan_queue').update(row.recordId, { status: 'cancelled' })
      } catch {
        await pb.collection('scan_queue').delete(row.recordId)
      }
      return
    }

    try {
      await pb.collection('scan_queue').update(row.recordId, { status: 'cancelled' })
    } catch {
      await pb.collection('scan_queue').update(row.recordId, { status: 'failed' })
    }

    const activeScan = activeScans.value.find(
      s =>
        s.site === row.siteId
        && (s.status === 'running' || s.status === 'background_scan')
    )
    if (activeScan) {
      await cancelRunningScan(activeScan.id)
    }
  }

  async function cancelActiveScan(row: ActiveScanRow): Promise<void> {
    await awaitAuthReady()
    syncAuth()

    if (row.source === 'queue') {
      await cancelQueueItem(row)
      return
    }

    await cancelRunningScan(row.recordId)
  }

  async function deleteScan(scanId: string, siteId?: string): Promise<void> {
    await awaitAuthReady()
    syncAuth()
    await pb.collection('scans').delete(scanId)
    invalidateScanPagesCache(scanId)
    if (siteId) {
      await refreshSiteScansIfLoaded(siteId)
    }
  }

  async function restartScan(row: ActiveScanRow | Scan): Promise<boolean> {
    const siteId = 'siteId' in row ? row.siteId : row.site
    if (isSiteBusy(siteId)) {
      return false
    }

    let rawConfig: Record<string, unknown> | null = null

    if ('source' in row) {
      rawConfig = row.rawConfig ?? null
    } else {
      rawConfig = row.raw_config ?? null
    }

    if (!rawConfig) {
      const site = sites.value.find(s => s.id === siteId)
      rawConfig = site?.default_scan_config ?? null
    }

    if (!rawConfig) {
      rawConfig = { mode: 'full', maxPages: 500, maxDepth: 10 }
    }

    const parsed = parseScanConfig(rawConfig)
    await queueScanWithConfig(siteId, serializeScanConfig(parsed), deriveScanType(parsed))
    return true
  }

  async function fetchCollectionPage<T>(
    collection: string,
    filter: string,
    expand?: string
  ): Promise<T[]> {
    const items: T[] = []
    let page = 1
    let totalItems = 0

    do {
      const result = await pb.collection(collection).getList(page, ACTIVE_LIST_PAGE_SIZE, {
        filter,
        ...(expand ? { expand } : {})
      })
      items.push(...(result.items as unknown as T[]))
      totalItems = result.totalItems
      page += 1
    } while (items.length < totalItems && page <= 50)

    return items
  }

  async function fetchActiveCollection<T>(
    collection: string,
    filter: string,
    label: string
  ): Promise<T[]> {
    try {
      return await withFetchTimeout(
        fetchCollectionPage<T>(collection, filter, 'site'),
        label
      )
    } catch (err) {
      logQueryError(label, err)
      try {
        return await withFetchTimeout(
          fetchCollectionPage<T>(collection, filter),
          `${label} (no expand)`
        )
      } catch (retryErr) {
        throw retryErr
      }
    }
  }

  async function fetchActive(options?: { silent?: boolean }) {
    await awaitAuthReady()
    syncAuth()
    if (!pb) {
      hasFetchedActiveOnce.value = true
      activeLoading.value = false
      return
    }
    if (!options?.silent) {
      activeLoading.value = true
    }
    const siteClause = filteredSiteId.value
    const errors: string[] = []

    try {
      const [queueSettled, scansSettled] = await Promise.allSettled([
        fetchActiveCollection<ScanQueueItem>(
          'scan_queue',
          buildActiveQueueFilter(siteClause),
          'Active scan queue'
        ),
        fetchActiveCollection<Scan>(
          'scans',
          buildActiveScansFilter(siteClause),
          'Active scans'
        )
      ])

      if (queueSettled.status === 'fulfilled') {
        activeQueue.value = queueSettled.value
      } else {
        errors.push(pocketBaseErrorMessage(queueSettled.reason))
        if (!options?.silent && !activeQueue.value.length) {
          activeQueue.value = []
        }
      }

      if (scansSettled.status === 'fulfilled') {
        activeScans.value = scansSettled.value
      } else {
        errors.push(pocketBaseErrorMessage(scansSettled.reason))
        if (!options?.silent && !activeScans.value.length) {
          activeScans.value = []
        }
      }

      if (errors.length) {
        error.value = errors[0]!
      } else if (!options?.silent) {
        error.value = ''
      }

      // PocketBase `sort` is returning 400 in this environment; sort client-side.
      activeQueue.value = activeQueue.value.slice().sort((a, b) =>
        compareTimestampsDesc(a.created, b.created)
      )
      activeScans.value = activeScans.value.slice().sort((a, b) =>
        compareTimestampsDesc(a.started_at ?? a.created, b.started_at ?? b.created)
      )
    } finally {
      activeLoading.value = false
      hasFetchedActiveOnce.value = true
    }
  }

  function markSiteScansLoaded(siteId: string) {
    const next = new Set(siteScansLoaded.value)
    next.add(siteId)
    siteScansLoaded.value = next
  }

  function isSiteScansLoaded(siteId: string): boolean {
    return siteScansLoaded.value.has(siteId)
  }

  /** Refetch per-site history when already loaded; keeps stale rows visible while loading. */
  function refreshSiteScansIfLoaded(siteId: string): Promise<void> {
    if (!siteScansLoaded.value.has(siteId)) return Promise.resolve()
    return loadScansForSite(siteId, true).then(() => undefined).catch(() => undefined)
  }

  function invalidateSiteScansCache(siteId: string) {
    void refreshSiteScansIfLoaded(siteId)
  }

  function invalidateScanPagesCache(scanId: string) {
    const next = new Map(pagesByScan.value)
    next.delete(scanId)
    pagesByScan.value = next
  }

  async function fetchLatestScansSummary() {
    await awaitAuthReady()
    syncAuth()
    try {
      const items = await pb.collection('scans').getList(1, 200, {
        fields: 'id,site,status,pages_crawled,started_at,completed_at,created,scan_type,score_overall,scan_quality',
        skipTotal: true
      })
      latestScansRaw.value = (items.items as unknown as Scan[]).slice().sort((a, b) =>
        compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b))
      )
    } catch (e: unknown) {
      const message = pocketBaseErrorMessage(e)
      if (/autocancelled|timed out|TimeoutError/i.test(message)) return
      logQueryError('fetchLatestScansSummary', e)
      error.value = message || 'Could not load latest scans summary'
    }
  }

  async function loadScansForSite(siteId: string, force = false): Promise<Scan[]> {
    if (!force && scansBySite.value.has(siteId)) {
      return scansBySite.value.get(siteId)!
    }

    await awaitAuthReady()
    syncAuth()

    const loading = new Set(siteScansLoading.value)
    loading.add(siteId)
    siteScansLoading.value = loading

    try {
      const result = await pb.collection('scans').getList(1, SITE_SCANS_PAGE_SIZE, {
        filter: pbRelation('site', siteId)
      })
      const scans = (result.items as unknown as Scan[]).slice().sort((a, b) =>
        compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b))
      )
      const next = new Map(scansBySite.value)
      next.set(siteId, scans)
      scansBySite.value = next
      markSiteScansLoaded(siteId)
      return scans
    } catch (e: unknown) {
      logQueryError(`loadScansForSite(${siteId})`, e)
      error.value = pocketBaseErrorMessage(e) || 'Could not load scans for site'
      markSiteScansLoaded(siteId)
      return scansBySite.value.get(siteId) ?? []
    } finally {
      const done = new Set(siteScansLoading.value)
      done.delete(siteId)
      siteScansLoading.value = done
    }
  }

  async function loadPagesForScan(scanId: string, force = false): Promise<PageRecord[]> {
    if (!force && pagesByScan.value.has(scanId)) {
      return pagesByScan.value.get(scanId)!
    }

    await awaitAuthReady()
    syncAuth()

    const loading = new Set(scanPagesLoading.value)
    loading.add(scanId)
    scanPagesLoading.value = loading

    try {
      const pages = await pb.collection('pages').getFullList({
        filter: pbRelation('scan', scanId),
        sort: 'url'
      }) as unknown as PageRecord[]
      const next = new Map(pagesByScan.value)
      next.set(scanId, pages)
      pagesByScan.value = next
      return pages
    } catch (e: unknown) {
      error.value = pocketBaseErrorMessage(e) || 'Could not load pages for scan'
      return []
    } finally {
      const done = new Set(scanPagesLoading.value)
      done.delete(scanId)
      scanPagesLoading.value = done
    }
  }

  function isSiteScansLoading(siteId: string): boolean {
    return siteScansLoading.value.has(siteId)
  }

  function isScanPagesLoading(scanId: string): boolean {
    return scanPagesLoading.value.has(scanId)
  }

  async function fetchHistory() {
    await awaitAuthReady()
    syncAuth()
    historyLoading.value = true
    error.value = ''
    const baseOptions = {
      filter: buildHistoryFilter(filteredSiteId.value, statusFilter.value),
      expand: 'site'
    }
    try {
      let result
      try {
        result = await pb.collection('scans').getList(historyPage.value, HISTORY_PAGE_SIZE, {
          ...baseOptions,
          sort: '-started_at'
        })
      } catch {
        result = await pb.collection('scans').getList(historyPage.value, HISTORY_PAGE_SIZE, baseOptions)
      }
      historyScans.value = (result.items as unknown as Scan[]).slice().sort((a, b) =>
        compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b))
      )
      historyTotal.value = result.totalItems
    } catch (e: unknown) {
      logQueryError('fetchHistory', e)
      error.value = pocketBaseErrorMessage(e) || 'Could not load scan history'
    } finally {
      historyLoading.value = false
    }
  }

  async function fetchRecentScans() {
    historyPage.value = 1
    await fetchHistory()
  }

  async function refreshAll() {
    await Promise.all([
      fetchActive(),
      fetchLatestScansSummary(),
      fetchHistory().catch(() => {})
    ])
    const reloadIds = new Set(siteScansLoaded.value)
    if (expandedSiteId.value) {
      reloadIds.add(expandedSiteId.value)
    }
    await Promise.all([...reloadIds].map(id => loadScansForSite(id, true)))
  }

  function resolveSiteForScan(scan: Scan): Site | null {
    const expanded = scan.expand?.site
    if (expanded?.id) {
      return {
        id: expanded.id,
        name: expanded.name,
        url: expanded.url,
        created: '',
        updated: ''
      }
    }
    const found = sites.value.find(s => s.id === scan.site)
    return found || null
  }

  async function openRescan(scan: Scan) {
    if (isSiteBusy(scan.site)) {
      return false
    }

    let site = resolveSiteForScan(scan)
    if (!site) {
      if (!sites.value.length) {
        await fetchSites()
      }
      site = sites.value.find(s => s.id === scan.site) || null
    }
    if (!site) {
      try {
        site = await pb.collection('sites').getOne(scan.site) as unknown as Site
      } catch {
        return false
      }
    }

    rescanSite.value = site
    rescanRawConfig.value = scan.raw_config ?? site.default_scan_config ?? null
    rescanModalOpen.value = true
    return true
  }

  function closeRescanModal() {
    rescanModalOpen.value = false
    rescanSite.value = null
    rescanRawConfig.value = null
  }

  let unsubscribeQueue: (() => void) | null = null
  let unsubscribeScans: (() => void) | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function subscribeRealtime() {
    await awaitAuthReady()
    syncAuth()

    if (unsubscribeQueue) {
      unsubscribeQueue()
      unsubscribeQueue = null
    }
    if (unsubscribeScans) {
      unsubscribeScans()
      unsubscribeScans = null
    }

    try {
      unsubscribeQueue = await pb.collection('scan_queue').subscribe('*', () => {
        fetchActive({ silent: true }).catch(() => {})
      })
      unsubscribeScans = await pb.collection('scans').subscribe('*', (e) => {
        const record = e.record as unknown as Scan
        const status = record?.status
        fetchActive({ silent: true }).catch(() => {})
        if (record?.site) {
          refreshSiteScansIfLoaded(record.site)
        }
        if (TERMINAL_SCAN_STATUSES.includes(status as typeof TERMINAL_SCAN_STATUSES[number])) {
          fetchLatestScansSummary().catch(() => {})
          if (record?.id) invalidateScanPagesCache(record.id)
          if (status === 'complete' || status === 'complete_with_errors') {
            const { markFirstScanComplete, onboardingState } = useOnboarding()
            if (!onboardingState.value.firstScanStarted) {
              markFirstScanComplete().catch(() => {})
            }
          }
        }
      })
    } catch {
      if (!pollTimer) {
        pollTimer = setInterval(() => {
          refreshAll()
        }, 30000)
      }
    }
  }

  function unsubscribeRealtime() {
    if (unsubscribeQueue) {
      unsubscribeQueue()
      unsubscribeQueue = null
    }
    if (unsubscribeScans) {
      unsubscribeScans()
      unsubscribeScans = null
    }
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function resetSession() {
    siteFilter.value = null
    statusFilter.value = 'all'
    activeQueue.value = []
    activeScans.value = []
    historyScans.value = []
    historyPage.value = 1
    historyTotal.value = 0
    activeLoading.value = false
    hasFetchedActiveOnce.value = false
    historyLoading.value = false
    error.value = ''
    latestScansRaw.value = []
    scansBySite.value = new Map()
    pagesByScan.value = new Map()
    siteScansLoading.value = new Set()
    siteScansLoaded.value = new Set()
    scanPagesLoading.value = new Set()
    expandedSiteId.value = null
    rescanModalOpen.value = false
    rescanSite.value = null
    rescanRawConfig.value = null
  }

  return {
    siteFilter,
    statusFilter,
    resetSession,
    activeQueue,
    activeScans,
    activeRows,
    historyScans,
    historyPage,
    historyTotal,
    historyPageCount,
    activeLoading,
    hasFetchedActiveOnce,
    historyLoading,
    error,
    rescanModalOpen,
    rescanSite,
    rescanRawConfig,
    isSiteBusy,
    cancelActiveScan,
    deleteScan,
    restartScan,
    fetchActive,
    fetchHistory,
    fetchRecentScans,
    refreshAll,
    openRescan,
    closeRescanModal,
    subscribeRealtime,
    unsubscribeRealtime,
    latestScanBySiteId,
    latestCompleteScanBySiteId,
    scansBySite,
    pagesByScan,
    loadScansForSite,
    loadPagesForScan,
    isSiteScansLoading,
    isSiteScansLoaded,
    isScanPagesLoading,
    fetchLatestScansSummary,
    invalidateSiteScansCache,
    refreshSiteScansIfLoaded,
    expandedSiteId,
    siteScansLoaded,
    HISTORY_PAGE_SIZE
  }
}

export const useScans = createSharedComposable(_useScans)
