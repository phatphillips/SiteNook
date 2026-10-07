import type { PageRecord, Scan, SeoIssue } from '~/types/sitenook'
import { buildDisplayScansFilter, pickDisplayScan, sortScansForDisplay } from '~/utils/scanDisplay'
import { pbRelation } from '~/utils/pbFilter'
import { createDebouncedReload } from '~/utils/reloadScheduler'
import { countOpenByCategory, sortSeoIssues } from '~/utils/seoIssues'
import { issueForCrawlFile } from '~/utils/crawlAuditDisplay'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import {
  averageReadabilityForScan,
  countCollection,
  FullListGuardError,
  safeGetFullList
} from '~/utils/pbCollectionCount'

const READABILITY_RULES = new Set(['low-readability', 'thin-content'])

type SeoDetailPart = 'issues' | 'pages'

export type UseSEOOptions = {
  /** When true (default), load category counts only. No bulk issue/page arrays. */
  summary?: boolean
  parts?: SeoDetailPart[]
}

export function useSEO(
  siteId: Ref<string> | string,
  options: UseSEOOptions = {}
) {
  const summaryMode = options.summary !== false
  const loadParts = options.parts
  const { pb } = usePocketBase()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const latestScan = ref<Scan | null>(null)
  const scans = ref<Scan[]>([])
  const issues = ref<SeoIssue[]>([])
  const pages = ref<PageRecord[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)

  const categoryCountsSummary = ref({ technical: 0, content: 0 })
  const contentStructureCountSummary = ref(0)
  const contentReadabilityCountSummary = ref(0)
  const avgReadabilitySummary = ref<number | null>(null)

  const pendingParts = new Set<SeoDetailPart>()
  let fetchGeneration = 0

  function clearDetailData() {
    issues.value = []
    pages.value = []
    categoryCountsSummary.value = { technical: 0, content: 0 }
    contentStructureCountSummary.value = 0
    contentReadabilityCountSummary.value = 0
    avgReadabilitySummary.value = null
  }

  function resetForSiteChange() {
    clearDetailData()
    latestScan.value = null
    scans.value = []
  }

  function openIssuesFilter(scanId: string, extra?: string) {
    const base = `${pbRelation('scan', scanId)} && status = 'open'`
    return extra ? `${base} && ${extra}` : base
  }

  async function loadIssues(scanId: string) {
    if (!pb) return
    issues.value = await safeGetFullList<SeoIssue>(pb, 'seo_issues', {
      filter: openIssuesFilter(scanId),
      expand: 'page'
    })
    issues.value = sortSeoIssues(issues.value)
  }

  async function loadPages(scanId: string) {
    if (!pb) return
    pages.value = await safeGetFullList<PageRecord>(pb, 'pages', {
      filter: pbRelation('scan', scanId)
    })
  }

  async function loadSummaryCounts(scanId: string) {
    if (!pb) return
    const [technical, content, structure, readability, avgRead] = await Promise.all([
      countCollection(pb, 'seo_issues', openIssuesFilter(scanId, `category = 'technical'`)),
      countCollection(pb, 'seo_issues', openIssuesFilter(scanId, `category = 'content'`)),
      countCollection(pb, 'seo_issues', openIssuesFilter(
        scanId,
        `category = 'content' && rule_id != 'low-readability' && rule_id != 'thin-content'`
      )),
      countCollection(pb, 'seo_issues', openIssuesFilter(
        scanId,
        `(rule_id = 'low-readability' || rule_id = 'thin-content')`
      )),
      averageReadabilityForScan(pb, scanId)
    ])
    categoryCountsSummary.value = { technical, content }
    contentStructureCountSummary.value = structure
    contentReadabilityCountSummary.value = readability
    avgReadabilitySummary.value = avgRead || null
  }

  async function loadScanDetails(scanId: string, parts?: SeoDetailPart[]) {
    const requested = parts?.length ? parts : (loadParts?.length ? loadParts : (['issues', 'pages'] as SeoDetailPart[]))
    loadError.value = null
    try {
      const tasks: Promise<void>[] = []
      if (requested.includes('issues')) tasks.push(loadIssues(scanId))
      if (requested.includes('pages')) tasks.push(loadPages(scanId))
      await Promise.all(tasks)
    } catch (err) {
      if (err instanceof FullListGuardError) {
        loadError.value = err.message
      } else {
        throw err
      }
    }
  }

  async function flushPendingParts() {
    const scanId = latestScan.value?.id
    if (!scanId) return
    const parts = [...pendingParts]
    pendingParts.clear()
    if (parts.length) await loadScanDetails(scanId, parts)
  }

  const debouncedReload = createDebouncedReload(async () => {
    await flushPendingParts()
  })

  function scheduleReload(...parts: SeoDetailPart[]) {
    if (!latestScan.value?.id) return
    for (const part of parts) pendingParts.add(part)
    debouncedReload.schedule()
  }

  async function fetchSEOData(options?: { silent?: boolean }) {
    if (!id.value || !pb) return
    const generation = ++fetchGeneration
    if (!options?.silent) loading.value = true
    loadError.value = null
    try {
      const scanList = await pb.collection('scans').getFullList({
        filter: buildDisplayScansFilter(id.value)
      })
      if (generation !== fetchGeneration) return

      scans.value = (scanList as unknown as Scan[]).slice().sort((a, b) =>
        compareTimestampsDesc(
          a.completed_at ?? a.started_at ?? a.created,
          b.completed_at ?? b.started_at ?? b.created
        )
      )
      latestScan.value = pickDisplayScan(sortScansForDisplay(scans.value))
      if (!latestScan.value) {
        clearDetailData()
        return
      }

      if (summaryMode) {
        issues.value = []
        pages.value = []
        await loadSummaryCounts(latestScan.value.id)
        if (generation !== fetchGeneration) return
        return
      }

      await loadScanDetails(latestScan.value.id)
      if (generation !== fetchGeneration) return
    } finally {
      if (generation === fetchGeneration && !options?.silent) {
        loading.value = false
      }
    }
  }

  const seoScore = computed(() => latestScan.value?.score_seo ?? null)
  const technicalScore = computed(() => latestScan.value?.score_seo_technical ?? null)
  const contentScore = computed(() => latestScan.value?.score_seo_content ?? null)
  const crawlabilityScore = computed(() => latestScan.value?.score_seo_crawlability ?? null)
  const crawlAudit = computed(() => latestScan.value?.seo_crawl_audit ?? null)

  const openIssues = computed(() => issues.value.filter(i => i.status === 'open'))
  const crawlabilityIssues = computed(() =>
    openIssues.value.filter(i => i.subcategory === 'crawlability')
  )
  const categoryCounts = computed(() =>
    summaryMode
      ? categoryCountsSummary.value
      : countOpenByCategory(issues.value)
  )

  const contentStructureIssueCount = computed(() =>
    summaryMode
      ? contentStructureCountSummary.value
      : openIssues.value.filter(i =>
          i.category === 'content' && !READABILITY_RULES.has(i.rule_id)
        ).length
  )

  const contentReadabilityIssueCount = computed(() =>
    summaryMode
      ? contentReadabilityCountSummary.value
      : openIssues.value.filter(i => READABILITY_RULES.has(i.rule_id)).length
  )

  const avgReadabilityScore = computed(() => {
    if (summaryMode) return avgReadabilitySummary.value
    const scores = pages.value
      .map(p => p.readability_score)
      .filter((s): s is number => typeof s === 'number' && s > 0)
    if (!scores.length) return null
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  })

  async function updateSeoIssueStatuses(input: {
    issueIds: string[]
    action: 'dismiss' | 'reopen' | 'fixed'
  }) {
    if (!id.value || !input.issueIds.length || !pb) return
    const token = pb.authStore.token
    if (!token) return
    await $fetch(`/api/sites/${id.value}/seo/issues/bulk-status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: input
    })
    await fetchSEOData({ silent: true })
  }

  let unsubscribeScans: (() => void) | null = null
  let unsubscribeIssues: (() => void) | null = null
  let unsubscribePages: (() => void) | null = null

  function unsubscribeSEO() {
    unsubscribeScans?.()
    unsubscribeIssues?.()
    unsubscribePages?.()
    unsubscribeScans = null
    unsubscribeIssues = null
    unsubscribePages = null
    debouncedReload.cancel()
  }

  async function subscribeSEOUpdates() {
    unsubscribeSEO()
    if (!id.value || !pb) return

    try {
      unsubscribeScans = await pb.collection('scans').subscribe('*', (e) => {
        const record = e.record as { site?: string }
        if (record.site !== id.value) return
        fetchSEOData({ silent: true }).catch(() => {})
      })

      if (summaryMode) return

      unsubscribeIssues = await pb.collection('seo_issues').subscribe('*', (e) => {
        const record = e.record as { site?: string, scan?: string }
        if (record.site !== id.value) return
        if (latestScan.value?.id && record.scan === latestScan.value.id) {
          scheduleReload('issues')
        }
      })
      unsubscribePages = await pb.collection('pages').subscribe('*', (e) => {
        const record = e.record as { site?: string, scan?: string }
        if (record.site !== id.value) return
        if (latestScan.value?.id && record.scan === latestScan.value.id) {
          scheduleReload('pages')
        }
      })
    } catch {
      // realtime optional
    }
  }

  watch(id, (nextId, previousId) => {
    if (nextId !== previousId) {
      fetchGeneration++
      resetForSiteChange()
      loadError.value = null
    }
    fetchSEOData()
    subscribeSEOUpdates()
  }, { immediate: true })

  onUnmounted(() => {
    fetchGeneration++
    unsubscribeSEO()
    resetForSiteChange()
  })

  return {
    latestScan,
    scans,
    issues,
    pages,
    loading,
    loadError,
    seoScore,
    technicalScore,
    contentScore,
    crawlabilityScore,
    crawlAudit,
    openIssues,
    crawlabilityIssues,
    categoryCounts,
    contentStructureIssueCount,
    contentReadabilityIssueCount,
    avgReadabilityScore,
    updateSeoIssueStatuses,
    issueForCrawlFile: (key: 'robots' | 'sitemap' | 'llms') =>
      issueForCrawlFile(openIssues.value, key),
    fetchSEOData
  }
}
