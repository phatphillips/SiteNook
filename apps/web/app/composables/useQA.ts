import type { BrokenLink, PageRecord, Scan, SpellingIssue } from '~/types/accessiq'
import { buildDisplayScansFilter, pickDisplayScan, sortScansForDisplay } from '~/utils/scanDisplay'
import { pbAnd, pbContains, pbRelation } from '~/utils/pbFilter'
import { createDebouncedReload } from '~/utils/reloadScheduler'

type ScanDetailPart = 'links' | 'spelling' | 'pages' | 'inventory'

export function useQA(siteId: Ref<string> | string) {
  const { pb } = usePocketBase()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const latestScan = ref<Scan | null>(null)
  const brokenLinks = ref<BrokenLink[]>([])
  const spelling = ref<SpellingIssue[]>([])
  const pages = ref<PageRecord[]>([])
  const inventory = ref<Record<string, unknown>[]>([])
  const loading = ref(false)

  const pendingParts = new Set<ScanDetailPart>()

  async function loadBrokenLinks(scanId: string, hrefQuery?: string) {
    const clauses = [pbRelation('scan', scanId)]
    const q = hrefQuery?.trim()
    if (q) clauses.push(pbContains('href', q))

    brokenLinks.value = await pb.collection('qa_broken_links').getFullList({
      filter: pbAnd(clauses),
      expand: 'page'
    }) as unknown as BrokenLink[]
  }

  async function fetchBrokenLinks(options?: { hrefQuery?: string }) {
    const scanId = latestScan.value?.id
    if (!scanId) {
      brokenLinks.value = []
      return
    }
    await loadBrokenLinks(scanId, options?.hrefQuery)
  }

  async function loadSpelling(scanId: string) {
    spelling.value = await pb.collection('qa_spelling').getFullList({
      filter: pbRelation('scan', scanId),
      expand: 'page'
    }) as unknown as SpellingIssue[]
  }

  async function loadPages(scanId: string) {
    pages.value = await pb.collection('pages').getFullList({
      filter: pbRelation('scan', scanId)
    }) as unknown as PageRecord[]
  }

  async function loadInventory(scanId: string) {
    inventory.value = await pb.collection('qa_inventory').getFullList({
      filter: pbRelation('scan', scanId)
    })
  }

  async function loadScanDetails(scanId: string, parts?: ScanDetailPart[]) {
    const requested = parts?.length
      ? parts
      : (['links', 'spelling', 'pages', 'inventory'] as ScanDetailPart[])

    const tasks: Promise<void>[] = []
    if (requested.includes('links')) tasks.push(loadBrokenLinks(scanId))
    if (requested.includes('spelling')) tasks.push(loadSpelling(scanId))
    if (requested.includes('pages')) tasks.push(loadPages(scanId))
    if (requested.includes('inventory')) tasks.push(loadInventory(scanId))
    await Promise.all(tasks)
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

  async function fetchQAData(options?: { silent?: boolean }) {
    if (!id.value) return
    if (!options?.silent) {
      loading.value = true
    }
    try {
      const scanList = await pb.collection('scans').getFullList({
        filter: buildDisplayScansFilter(id.value)
      })
      latestScan.value = pickDisplayScan(sortScansForDisplay(scanList as unknown as Scan[]))
      if (!latestScan.value) {
        brokenLinks.value = []
        spelling.value = []
        pages.value = []
        inventory.value = []
        return
      }

      await loadScanDetails(latestScan.value.id)
    } finally {
      if (!options?.silent) {
        loading.value = false
      }
    }
  }

  const brokenLinkCount = computed(() => brokenLinks.value.filter(l => l.status === 'broken').length)
  const misspellingCount = computed(() => spelling.value.filter(s => s.confidence === 'error').length)
  const avgReadability = computed(() => {
    if (!pages.value.length) return 0
    const sum = pages.value.reduce((n, p) => n + (p.readability_score || 0), 0)
    return Math.round(sum / pages.value.length)
  })

  let unsubscribeScans: (() => void) | null = null
  let unsubscribePages: (() => void) | null = null
  let unsubscribeBrokenLinks: (() => void) | null = null
  let unsubscribeSpelling: (() => void) | null = null
  let unsubscribeInventory: (() => void) | null = null

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
    debouncedReload.cancel()
  }

  async function subscribeQAUpdates() {
    unsubscribeQA()
    if (!id.value) return

    try {
      unsubscribeScans = await pb.collection('scans').subscribe('*', (e) => {
        const record = e.record as { site?: string }
        if (record.site !== id.value) return
        fetchQAData({ silent: true }).catch(() => {})
      })
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

  return {
    latestScan,
    brokenLinks,
    spelling,
    pages,
    inventory,
    loading,
    brokenLinkCount,
    misspellingCount,
    avgReadability,
    fetchQAData,
    fetchBrokenLinks
  }
}
