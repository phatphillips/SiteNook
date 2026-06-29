import type { PageRecord, Scan, SeoIssue } from '~/types/accessiq'
import { buildDisplayScansFilter, pickDisplayScan, sortScansForDisplay } from '~/utils/scanDisplay'
import { pbRelation } from '~/utils/pbFilter'
import { createDebouncedReload } from '~/utils/reloadScheduler'
import { countOpenByCategory, sortSeoIssues } from '~/utils/seoIssues'
import { issueForCrawlFile } from '~/utils/crawlAuditDisplay'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'

const READABILITY_RULES = new Set(['low-readability', 'thin-content'])

type SeoDetailPart = 'issues' | 'pages'

export function useSEO(siteId: Ref<string> | string) {
  const { pb } = usePocketBase()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const latestScan = ref<Scan | null>(null)
  const scans = ref<Scan[]>([])
  const issues = ref<SeoIssue[]>([])
  const pages = ref<PageRecord[]>([])
  const loading = ref(false)

  const pendingParts = new Set<SeoDetailPart>()

  async function loadIssues(scanId: string) {
    issues.value = await pb.collection('seo_issues').getFullList({
      filter: `${pbRelation('scan', scanId)} && status = 'open'`,
      expand: 'page'
    }) as unknown as SeoIssue[]
    issues.value = sortSeoIssues(issues.value)
  }

  async function loadPages(scanId: string) {
    pages.value = await pb.collection('pages').getFullList({
      filter: pbRelation('scan', scanId)
    }) as unknown as PageRecord[]
  }

  async function loadScanDetails(scanId: string, parts?: SeoDetailPart[]) {
    const requested = parts?.length ? parts : (['issues', 'pages'] as SeoDetailPart[])
    const tasks: Promise<void>[] = []
    if (requested.includes('issues')) tasks.push(loadIssues(scanId))
    if (requested.includes('pages')) tasks.push(loadPages(scanId))
    await Promise.all(tasks)
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
    if (!id.value) return
    if (!options?.silent) loading.value = true
    try {
      const scanList = await pb.collection('scans').getFullList({
        filter: buildDisplayScansFilter(id.value)
      })
      scans.value = (scanList as unknown as Scan[]).slice().sort((a, b) =>
        compareTimestampsDesc(
          a.completed_at ?? a.started_at ?? a.created,
          b.completed_at ?? b.started_at ?? b.created
        )
      )
      latestScan.value = pickDisplayScan(sortScansForDisplay(scans.value))
      if (!latestScan.value) {
        issues.value = []
        pages.value = []
        return
      }
      await loadScanDetails(latestScan.value.id)
    } finally {
      if (!options?.silent) loading.value = false
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
  const categoryCounts = computed(() => countOpenByCategory(issues.value))

  const contentStructureIssueCount = computed(() =>
    openIssues.value.filter(i =>
      i.category === 'content' && !READABILITY_RULES.has(i.rule_id)
    ).length
  )

  const contentReadabilityIssueCount = computed(() =>
    openIssues.value.filter(i => READABILITY_RULES.has(i.rule_id)).length
  )

  const avgReadabilityScore = computed(() => {
    const scores = pages.value
      .map(p => p.readability_score)
      .filter((s): s is number => typeof s === 'number' && s > 0)
    if (!scores.length) return null
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  })

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
    if (!id.value) return

    try {
      unsubscribeScans = await pb.collection('scans').subscribe('*', (e) => {
        const record = e.record as { site?: string }
        if (record.site !== id.value) return
        fetchSEOData({ silent: true }).catch(() => {})
      })
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

  watch(id, () => {
    fetchSEOData()
    subscribeSEOUpdates()
  }, { immediate: true })

  onUnmounted(() => unsubscribeSEO())

  return {
    latestScan,
    scans,
    issues,
    pages,
    loading,
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
    issueForCrawlFile: (key: 'robots' | 'sitemap' | 'llms') =>
      issueForCrawlFile(openIssues.value, key),
    fetchSEOData
  }
}
