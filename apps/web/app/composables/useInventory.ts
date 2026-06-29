import type { InventoryPageRow, Scan } from '~/types/accessiq'
import { mergeInventoryPages, pickBaselineCompleteScan } from '~/utils/inventoryPages'
import { pbRelation } from '~/utils/pbFilter'
import { createDebouncedReload } from '~/utils/reloadScheduler'
import { buildDisplayScansFilter, isScanRunning, pickDisplayScan, sortScansForDisplay } from '~/utils/scanDisplay'

type ReloadPart = 'scans' | 'pages' | 'inventory'

function pocketBaseErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: string }).message)
  }
  return 'Request failed'
}

export function useInventory(siteId: Ref<string> | string) {
  const { pb } = usePocketBase()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const latestScan = ref<Scan | null>(null)
  const baselineScan = ref<Scan | null>(null)
  const runningScan = ref<Scan | null>(null)
  const sitePages = ref<InventoryPageRow[]>([])
  const inventoryPages = ref<InventoryPageRow[]>([])
  const inventory = ref<Record<string, unknown>[]>([])
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref('')

  const pendingParts = new Set<ReloadPart>()

  async function loadScans() {
    const scanList = await pb.collection('scans').getFullList({
      filter: buildDisplayScansFilter(id.value)
    }) as unknown as Scan[]

    const sorted = sortScansForDisplay(scanList)
    latestScan.value = pickDisplayScan(sorted)
    runningScan.value = sorted.find(s => isScanRunning(s)) ?? null
    baselineScan.value = pickBaselineCompleteScan(scanList)
  }

  async function loadSitePages() {
    sitePages.value = await pb.collection('pages').getFullList({
      filter: pbRelation('site', id.value),
      expand: 'scan'
    }) as unknown as InventoryPageRow[]

    inventoryPages.value = mergeInventoryPages(
      sitePages.value,
      runningScan.value,
      baselineScan.value
    )
  }

  async function loadInventoryAssets() {
    const scanId = latestScan.value?.id
    if (!scanId) {
      inventory.value = []
      return
    }
    inventory.value = await pb.collection('qa_inventory').getFullList({
      filter: pbRelation('scan', scanId)
    })
  }

  async function flushPendingParts() {
    if (!id.value) return

    const parts = new Set(pendingParts)
    pendingParts.clear()

    if (parts.has('scans')) {
      await loadScans()
    }
    if (parts.has('pages')) {
      sitePages.value = await pb.collection('pages').getFullList({
        filter: pbRelation('site', id.value),
        expand: 'scan'
      }) as unknown as InventoryPageRow[]
      inventoryPages.value = mergeInventoryPages(
        sitePages.value,
        runningScan.value,
        baselineScan.value
      )
    } else if (parts.has('scans')) {
      inventoryPages.value = mergeInventoryPages(
        sitePages.value,
        runningScan.value,
        baselineScan.value
      )
    }
    if (parts.has('inventory') || parts.has('scans')) {
      await loadInventoryAssets()
    }
  }

  const debouncedReload = createDebouncedReload(async () => {
    if (!id.value) return
    refreshing.value = true
    try {
      await flushPendingParts()
      error.value = ''
    } catch (e: unknown) {
      error.value = pocketBaseErrorMessage(e) || 'Could not refresh inventory'
    } finally {
      refreshing.value = false
    }
  })

  function scheduleReload(...parts: ReloadPart[]) {
    for (const part of parts) pendingParts.add(part)
    debouncedReload.schedule()
  }

  async function fetchInventoryData(options?: { silent?: boolean }) {
    if (!id.value) return
    if (!options?.silent) {
      loading.value = true
    } else {
      refreshing.value = true
    }
    error.value = ''

    try {
      await loadScans()
      if (!latestScan.value) {
        sitePages.value = []
        inventoryPages.value = []
        inventory.value = []
        return
      }
      await Promise.all([loadSitePages(), loadInventoryAssets()])
    } catch (e: unknown) {
      error.value = pocketBaseErrorMessage(e) || 'Could not load inventory'
    } finally {
      if (!options?.silent) {
        loading.value = false
      } else {
        refreshing.value = false
      }
    }
  }

  let unsubscribeScans: (() => void) | null = null
  let unsubscribePages: (() => void) | null = null
  let unsubscribeInventory: (() => void) | null = null

  function unsubscribeInventoryUpdates() {
    if (unsubscribeScans) {
      unsubscribeScans()
      unsubscribeScans = null
    }
    if (unsubscribePages) {
      unsubscribePages()
      unsubscribePages = null
    }
    if (unsubscribeInventory) {
      unsubscribeInventory()
      unsubscribeInventory = null
    }
    debouncedReload.cancel()
  }

  async function subscribeInventoryUpdates() {
    unsubscribeInventoryUpdates()
    if (!id.value) return

    try {
      unsubscribeScans = await pb.collection('scans').subscribe('*', (e) => {
        const record = e.record as { site?: string }
        if (record.site !== id.value) return
        scheduleReload('scans', 'pages', 'inventory')
      })
      unsubscribePages = await pb.collection('pages').subscribe('*', (e) => {
        const record = e.record as { site?: string }
        if (record.site !== id.value) return
        scheduleReload('pages')
      })
      unsubscribeInventory = await pb.collection('qa_inventory').subscribe('*', (e) => {
        const record = e.record as { scan?: string }
        if (!record.scan || record.scan !== latestScan.value?.id) return
        scheduleReload('inventory')
      })
    } catch {
      // Realtime optional
    }
  }

  watch(id, () => {
    fetchInventoryData()
    subscribeInventoryUpdates()
  }, { immediate: true })

  onUnmounted(() => {
    unsubscribeInventoryUpdates()
  })

  return {
    latestScan,
    baselineScan,
    runningScan,
    inventoryPages,
    inventory,
    loading,
    refreshing,
    error,
    fetchInventoryData
  }
}
