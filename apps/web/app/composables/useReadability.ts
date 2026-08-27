import type { PageRecord, Scan } from '~/types/sitenook'
import type { ReadabilityPageRow } from '~/utils/readabilityMethods'
import { pbRelation } from '~/utils/pbFilter'
import { createDebouncedReload } from '~/utils/reloadScheduler'
import {
  buildDisplayScansFilter,
  pickDisplayScan,
  pickLatestCompleteScan,
  sortScansForDisplay
} from '~/utils/scanDisplay'
import { resolvePageReadabilityScores } from '~/utils/readabilityScoring'
import { siteSettingsForSite } from '~/utils/siteSettings'

/** Page fields for the readability table — omit html_snapshot to keep list loads reliable. */
const READABILITY_PAGE_FIELDS =
  'id,url,title,word_count,readability_score,readability_scores,scan,site,created'

function pocketBaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message)
  }
  return 'Failed to load readability data'
}

function toReadabilityRow(page: PageRecord): ReadabilityPageRow {
  return {
    id: page.id,
    url: page.url,
    title: page.title ?? '',
    word_count: page.word_count ?? 0,
    scores: resolvePageReadabilityScores({
      readability_scores: page.readability_scores,
      readability_score: page.readability_score
    })
  }
}

async function loadReadabilityPages(
  pb: ReturnType<typeof usePocketBase>['pb'],
  scanId: string
): Promise<PageRecord[]> {
  return await pb.collection('pages').getFullList({
    filter: pbRelation('scan', scanId),
    fields: READABILITY_PAGE_FIELDS
  }) as unknown as PageRecord[]
}

export function useReadability(siteId: Ref<string> | string) {
  const { pb } = usePocketBase()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))
  const { sites, refreshSite } = useSites()

  const rawPages = ref<PageRecord[]>([])
  const latestScan = ref<Scan | null>(null)
  const loading = ref(false)
  const error = ref('')

  const site = computed(() => sites.value.find(s => s.id === id.value) ?? null)
  const siteSettings = computed(() => siteSettingsForSite(site.value))

  const pages = computed<ReadabilityPageRow[]>(() =>
    rawPages.value.map(toReadabilityRow)
  )

  async function resolveScanWithPages(scanList: Scan[]): Promise<{
    scan: Scan | null
    pages: PageRecord[]
  }> {
    const sorted = sortScansForDisplay(scanList)
    const candidates = [
      pickDisplayScan(sorted),
      pickLatestCompleteScan(scanList)
    ].filter((scan, index, list): scan is Scan =>
      !!scan && list.findIndex(item => item?.id === scan.id) === index
    )

    for (const scan of candidates) {
      const loaded = await loadReadabilityPages(pb, scan.id)
      if (loaded.length) {
        return { scan, pages: loaded }
      }
    }

    return {
      scan: pickDisplayScan(sorted) ?? pickLatestCompleteScan(scanList),
      pages: []
    }
  }

  async function fetchReadabilityData(options?: { silent?: boolean }) {
    if (!import.meta.client || !id.value || !pb) return

    const generation = ++fetchGeneration
    if (!options?.silent) {
      loading.value = true
    }
    error.value = ''
    try {
      const scanList = await pb.collection('scans').getFullList({
        filter: buildDisplayScansFilter(id.value)
      }) as unknown as Scan[]

      if (generation !== fetchGeneration) return

      const result = await resolveScanWithPages(scanList)
      if (generation !== fetchGeneration) return

      latestScan.value = result.scan
      rawPages.value = result.pages
    } catch (e) {
      if (generation !== fetchGeneration) return
      error.value = pocketBaseErrorMessage(e)
      latestScan.value = null
      rawPages.value = []
    } finally {
      if (generation === fetchGeneration && !options?.silent) {
        loading.value = false
      }
    }
  }

  async function onReadabilityMethodsSaved() {
    await refreshSite(id.value)
  }

  const debouncedReload = createDebouncedReload(async () => {
    await fetchReadabilityData({ silent: true })
  })

  let unsubscribeScans: (() => void) | null = null
  let unsubscribePages: (() => void) | null = null
  let subscribeGeneration = 0
  let fetchGeneration = 0

  function unsubscribeReadability() {
    if (unsubscribeScans) {
      unsubscribeScans()
      unsubscribeScans = null
    }
    if (unsubscribePages) {
      unsubscribePages()
      unsubscribePages = null
    }
    debouncedReload.cancel()
  }

  async function subscribeReadabilityUpdates() {
    if (!import.meta.client || !pb) return
    const generation = ++subscribeGeneration
    unsubscribeReadability()
    if (!id.value) return

    try {
      const unsubScans = await pb.collection('scans').subscribe('*', (e) => {
        const record = e.record as { site?: string }
        if (record.site !== id.value) return
        debouncedReload.schedule()
      })
      if (generation !== subscribeGeneration) {
        unsubScans()
        return
      }
      unsubscribeScans = unsubScans

      const unsubPages = await pb.collection('pages').subscribe('*', (e) => {
        const record = e.record as { site?: string, scan?: string }
        if (record.site !== id.value) return
        if (!latestScan.value?.id || record.scan === latestScan.value.id) {
          debouncedReload.schedule()
        }
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

  watch(id, () => {
    if (!import.meta.client) return
    fetchGeneration += 1
    subscribeGeneration += 1
    unsubscribeReadability()
    void fetchReadabilityData()
    void subscribeReadabilityUpdates()
  }, { immediate: true })

  onUnmounted(() => {
    subscribeGeneration += 1
    unsubscribeReadability()
  })

  return {
    site,
    siteSettings,
    pages,
    loading,
    error,
    latestScan,
    fetchReadabilityData,
    onReadabilityMethodsSaved
  }
}
