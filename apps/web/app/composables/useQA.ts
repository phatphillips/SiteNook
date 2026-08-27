import type { BrokenLink, PageRecord, PolicyMatch, Scan, SpellingIssue } from '~/types/sitenook'
import { buildDisplayScansFilter, pickDisplayScan, sortScansForDisplay } from '~/utils/scanDisplay'
import { pbAnd, pbContains, pbRelation, pbSelect } from '~/utils/pbFilter'
import { createDebouncedReload } from '~/utils/reloadScheduler'
import {
  averageReadabilityForScan,
  countCollection,
  FullListGuardError,
  safeGetFullList
} from '~/utils/pbCollectionCount'
import { hydrateScanBrokenLinkCounts } from '~/utils/hydrateScanBrokenLinkCounts'

type ScanDetailPart = 'links' | 'spelling' | 'pages' | 'inventory' | 'policies'

export type UseQAOptions = {
  /** When true (default), load counts only — no bulk link/spelling/inventory arrays. */
  summary?: boolean
  /** Parts to load when summary is false. Defaults to all except inventory on detail pages. */
  parts?: ScanDetailPart[]
  /** Load preview rows and extended counts for overview pages. Implies summary mode. */
  overview?: boolean
}

export function useQA(
  siteId: Ref<string> | string,
  options: UseQAOptions = {}
) {
  const summaryMode = options.summary !== false
  const overviewMode = options.overview === true
  const loadParts = options.parts
  const { pb } = usePocketBase()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const scans = ref<Scan[]>([])
  const latestScan = ref<Scan | null>(null)
  const brokenLinks = ref<BrokenLink[]>([])
  const spelling = ref<SpellingIssue[]>([])
  const policyMatches = ref<PolicyMatch[]>([])
  const pages = ref<PageRecord[]>([])
  const inventory = ref<Record<string, unknown>[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)

  const brokenLinkCountSummary = ref(0)
  const misspellingCountSummary = ref(0)
  const policyMatchCountSummary = ref(0)
  const avgReadabilitySummary = ref(0)
  const wordsToReviewCountSummary = ref(0)
  const inventoryCountSummary = ref(0)
  const internalBrokenLinkCountSummary = ref(0)
  const externalBrokenLinkCountSummary = ref(0)

  const previewBrokenLinks = ref<BrokenLink[]>([])
  const previewSpelling = ref<SpellingIssue[]>([])
  const previewPolicyMatches = ref<PolicyMatch[]>([])

  const pendingParts = new Set<ScanDetailPart>()

  async function loadBrokenLinks(scanId: string, hrefQuery?: string) {
    if (!pb) return
    const clauses = [pbRelation('scan', scanId)]
    const q = hrefQuery?.trim()
    if (q) clauses.push(pbContains('href', q))

    brokenLinks.value = await safeGetFullList<BrokenLink>(pb, 'qa_broken_links', {
      filter: pbAnd(clauses),
      expand: 'page'
    })
  }

  async function fetchBrokenLinks(options?: { hrefQuery?: string }) {
    const scanId = latestScan.value?.id
    if (!scanId) {
      brokenLinks.value = []
      return
    }
    loadError.value = null
    try {
      await loadBrokenLinks(scanId, options?.hrefQuery)
    } catch (err) {
      if (err instanceof FullListGuardError) {
        loadError.value = err.message
        brokenLinks.value = []
      } else {
        throw err
      }
    }
  }

  async function loadSpelling(scanId: string) {
    if (!pb) return
    spelling.value = await safeGetFullList<SpellingIssue>(pb, 'qa_spelling', {
      filter: pbRelation('scan', scanId),
      expand: 'page'
    })
  }

  async function loadPolicyMatches(scanId: string) {
    if (!pb) return
    policyMatches.value = await safeGetFullList<PolicyMatch>(pb, 'policy_matches', {
      filter: pbRelation('scan', scanId),
      expand: 'page,policy'
    })
  }

  async function loadPages(scanId: string) {
    if (!pb) return
    pages.value = await safeGetFullList<PageRecord>(pb, 'pages', {
      filter: pbRelation('scan', scanId)
    })
  }

  async function loadInventory(scanId: string) {
    if (!pb) return
    inventory.value = await safeGetFullList<Record<string, unknown>>(pb, 'qa_inventory', {
      filter: pbRelation('scan', scanId)
    })
  }

  function resetSummaryCounts() {
    brokenLinkCountSummary.value = 0
    misspellingCountSummary.value = 0
    policyMatchCountSummary.value = 0
    avgReadabilitySummary.value = 0
    wordsToReviewCountSummary.value = 0
    inventoryCountSummary.value = 0
    internalBrokenLinkCountSummary.value = 0
    externalBrokenLinkCountSummary.value = 0
    previewBrokenLinks.value = []
    previewSpelling.value = []
    previewPolicyMatches.value = []
  }

  async function loadSummaryCounts(scanId: string) {
    if (!pb) return
    const [broken, misspellings, policies, readability] = await Promise.all([
      countCollection(pb, 'qa_broken_links', pbAnd([
        pbRelation('scan', scanId),
        pbSelect('status', 'broken')
      ])),
      countCollection(pb, 'qa_spelling', pbAnd([
        pbRelation('scan', scanId),
        pbSelect('confidence', 'error')
      ])),
      countCollection(pb, 'policy_matches', pbAnd([
        pbRelation('scan', scanId),
        pbSelect('status', 'open')
      ])),
      averageReadabilityForScan(pb, scanId)
    ])
    brokenLinkCountSummary.value = broken
    misspellingCountSummary.value = misspellings
    policyMatchCountSummary.value = policies
    avgReadabilitySummary.value = readability
  }

  async function loadOverviewExtras(scanId: string) {
    if (!pb) return
    const [
      review,
      inventory,
      internalLinks,
      externalLinks,
      linksResult,
      spellingResult,
      policiesResult
    ] = await Promise.all([
      countCollection(pb, 'qa_spelling', pbAnd([
        pbRelation('scan', scanId),
        pbSelect('confidence', 'review')
      ])),
      countCollection(pb, 'qa_inventory', pbRelation('scan', scanId)),
      countCollection(pb, 'qa_broken_links', pbAnd([
        pbRelation('scan', scanId),
        pbSelect('status', 'broken'),
        pbSelect('link_type', 'internal')
      ])),
      countCollection(pb, 'qa_broken_links', pbAnd([
        pbRelation('scan', scanId),
        pbSelect('status', 'broken'),
        pbSelect('link_type', 'external')
      ])),
      pb.collection('qa_broken_links').getList(1, 5, {
        filter: pbAnd([
          pbRelation('scan', scanId),
          pbSelect('status', 'broken')
        ]),
        expand: 'page',
        sort: '-status_code'
      }),
      pb.collection('qa_spelling').getList(1, 5, {
        filter: pbAnd([
          pbRelation('scan', scanId),
          pbSelect('confidence', 'error')
        ]),
        expand: 'page',
        sort: 'word'
      }),
      pb.collection('policy_matches').getList(1, 5, {
        filter: pbAnd([
          pbRelation('scan', scanId),
          pbSelect('status', 'open')
        ]),
        expand: 'page,policy',
        sort: '-created'
      })
    ])
    wordsToReviewCountSummary.value = review
    inventoryCountSummary.value = inventory
    internalBrokenLinkCountSummary.value = internalLinks
    externalBrokenLinkCountSummary.value = externalLinks
    previewBrokenLinks.value = linksResult.items as unknown as BrokenLink[]
    previewSpelling.value = spellingResult.items as unknown as SpellingIssue[]
    previewPolicyMatches.value = policiesResult.items as unknown as PolicyMatch[]
  }

  async function loadScanDetails(scanId: string, parts?: ScanDetailPart[]) {
    const requested = parts?.length
      ? parts
      : (['links', 'spelling', 'pages'] as ScanDetailPart[])

    loadError.value = null
    try {
      const tasks: Promise<void>[] = []
      if (requested.includes('links')) tasks.push(loadBrokenLinks(scanId))
      if (requested.includes('spelling')) tasks.push(loadSpelling(scanId))
      if (requested.includes('pages')) tasks.push(loadPages(scanId))
      if (requested.includes('inventory')) tasks.push(loadInventory(scanId))
      if (requested.includes('policies')) tasks.push(loadPolicyMatches(scanId))
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
    if (parts.length) {
      await loadScanDetails(scanId, parts)
    }
  }

  const debouncedReload = createDebouncedReload(async () => {
    await flushPendingParts()
  })

  function scheduleScanReload(...parts: ScanDetailPart[]) {
    if (!latestScan.value?.id) return
    for (const part of parts) pendingParts.add(part)
    debouncedReload.schedule()
  }

  async function fetchQAData(fetchOptions?: { silent?: boolean }) {
    if (!id.value || !pb) return
    if (!fetchOptions?.silent) {
      loading.value = true
    }
    loadError.value = null
    try {
      const scanList = await pb.collection('scans').getFullList({
        filter: buildDisplayScansFilter(id.value)
      })
      const sortedScans = sortScansForDisplay(scanList as unknown as Scan[])
      scans.value = overviewMode
        ? await hydrateScanBrokenLinkCounts(pb, sortedScans)
        : sortedScans
      latestScan.value = pickDisplayScan(scans.value)
      if (!latestScan.value) {
        scans.value = []
        brokenLinks.value = []
        spelling.value = []
        policyMatches.value = []
        pages.value = []
        inventory.value = []
        resetSummaryCounts()
        return
      }

      if (summaryMode) {
        brokenLinks.value = []
        spelling.value = []
        policyMatches.value = []
        pages.value = []
        inventory.value = []
        await loadSummaryCounts(latestScan.value.id)
        if (overviewMode) {
          await loadOverviewExtras(latestScan.value.id)
        } else {
          wordsToReviewCountSummary.value = 0
          inventoryCountSummary.value = 0
          internalBrokenLinkCountSummary.value = 0
          externalBrokenLinkCountSummary.value = 0
          previewBrokenLinks.value = []
          previewSpelling.value = []
          previewPolicyMatches.value = []
        }
        return
      }

      await loadScanDetails(latestScan.value.id, loadParts)
    } finally {
      if (!fetchOptions?.silent) {
        loading.value = false
      }
    }
  }

  const brokenLinkCount = computed(() =>
    summaryMode
      ? brokenLinkCountSummary.value
      : brokenLinks.value.filter(l => l.status === 'broken').length
  )
  const misspellingCount = computed(() =>
    summaryMode
      ? misspellingCountSummary.value
      : spelling.value.filter(s => s.confidence === 'error').length
  )
  const policyMatchCount = computed(() =>
    summaryMode
      ? policyMatchCountSummary.value
      : policyMatches.value.filter(m => m.status === 'open').length
  )
  const avgReadability = computed(() => {
    if (summaryMode) return avgReadabilitySummary.value
    if (!pages.value.length) return 0
    const sum = pages.value.reduce((n, p) => n + (p.readability_score || 0), 0)
    return Math.round(sum / pages.value.length)
  })

  async function updateQaIssueStatuses(input: {
    issueIds: string[]
    issueType: 'broken_links' | 'spelling' | 'policy_matches'
    action: 'dismiss' | 'reopen' | 'fixed'
  }) {
    if (!id.value || !input.issueIds.length || !pb) return
    const token = pb.authStore.token
    if (!token) return
    await $fetch(`/api/sites/${id.value}/qa/issues/bulk-status`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: input
    })
    await fetchQAData({ silent: true })
  }

  let unsubscribeScans: (() => void) | null = null
  let unsubscribePages: (() => void) | null = null
  let unsubscribeBrokenLinks: (() => void) | null = null
  let unsubscribeSpelling: (() => void) | null = null
  let unsubscribeInventory: (() => void) | null = null
  let unsubscribePolicyMatches: (() => void) | null = null

  function unsubscribeQA() {
    if (unsubscribeScans) {
      unsubscribeScans()
      unsubscribeScans = null
    }
    if (unsubscribePages) {
      unsubscribePages()
      unsubscribePages = null
    }
    if (unsubscribeBrokenLinks) {
      unsubscribeBrokenLinks()
      unsubscribeBrokenLinks = null
    }
    if (unsubscribeSpelling) {
      unsubscribeSpelling()
      unsubscribeSpelling = null
    }
    if (unsubscribeInventory) {
      unsubscribeInventory()
      unsubscribeInventory = null
    }
    if (unsubscribePolicyMatches) {
      unsubscribePolicyMatches()
      unsubscribePolicyMatches = null
    }
    debouncedReload.cancel()
  }

  async function subscribeQAUpdates() {
    unsubscribeQA()
    if (!id.value || !pb) return

    try {
      unsubscribeScans = await pb.collection('scans').subscribe('*', (e) => {
        const record = e.record as { site?: string }
        if (record.site !== id.value) return
        fetchQAData({ silent: true }).catch(() => {})
      })

      if (summaryMode) return

      unsubscribePages = await pb.collection('pages').subscribe('*', (e) => {
        const record = e.record as { site?: string, scan?: string }
        if (record.site !== id.value) return
        if (latestScan.value?.id && record.scan === latestScan.value.id) {
          scheduleScanReload('pages')
        } else if (!latestScan.value) {
          fetchQAData({ silent: true }).catch(() => {})
        }
      })
      const reloadIfCurrentScan = (scanId: string | undefined, part: ScanDetailPart) => {
        if (!scanId || !latestScan.value?.id) return
        if (scanId === latestScan.value.id) {
          scheduleScanReload(part)
        }
      }
      unsubscribeBrokenLinks = await pb.collection('qa_broken_links').subscribe('*', (e) => {
        const record = e.record as { scan?: string }
        reloadIfCurrentScan(record.scan, 'links')
      })
      unsubscribeSpelling = await pb.collection('qa_spelling').subscribe('*', (e) => {
        const record = e.record as { scan?: string }
        reloadIfCurrentScan(record.scan, 'spelling')
      })
      unsubscribeInventory = await pb.collection('qa_inventory').subscribe('*', (e) => {
        const record = e.record as { scan?: string }
        reloadIfCurrentScan(record.scan, 'inventory')
      })
      unsubscribePolicyMatches = await pb.collection('policy_matches').subscribe('*', (e) => {
        const record = e.record as { scan?: string }
        reloadIfCurrentScan(record.scan, 'policies')
      })
    } catch {
      // Realtime optional
    }
  }

  watch(id, () => {
    fetchQAData()
    subscribeQAUpdates()
  }, { immediate: true })

  onUnmounted(() => {
    unsubscribeQA()
  })

  const wordsToReviewCount = computed(() => wordsToReviewCountSummary.value)
  const inventoryCount = computed(() => inventoryCountSummary.value)
  const internalBrokenLinkCount = computed(() => internalBrokenLinkCountSummary.value)
  const externalBrokenLinkCount = computed(() => externalBrokenLinkCountSummary.value)

  return {
    scans,
    latestScan,
    brokenLinks,
    spelling,
    policyMatches,
    pages,
    inventory,
    previewBrokenLinks,
    previewSpelling,
    previewPolicyMatches,
    loading,
    loadError,
    brokenLinkCount,
    misspellingCount,
    policyMatchCount,
    avgReadability,
    wordsToReviewCount,
    inventoryCount,
    internalBrokenLinkCount,
    externalBrokenLinkCount,
    updateQaIssueStatuses,
    fetchQAData,
    fetchBrokenLinks
  }
}
