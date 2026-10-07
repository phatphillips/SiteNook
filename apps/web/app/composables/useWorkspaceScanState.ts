import type { Ref } from 'vue'
import { getCurrentInstance } from 'vue'
import { createSharedComposable } from '@vueuse/core'
import type { Scan } from '~/types/sitenook'
import { pbAnd, pbOr, pbRelation, pbSelect } from '~/utils/pbFilter'
import { TERMINAL_SCAN_STATUSES, SCAN_LIST_SORT } from '~/utils/scanDisplay'
import {
  deriveWorkspaceScanState,
  type WorkspaceScanState
} from '~/utils/workspaceScanState'
import { pickLatestTerminalScan } from '~/utils/workspaceScanQuery'

const ACTIVE_SCAN_STATUSES = ['running', 'background_scan'] as const
const TERMINAL_SCAN_FETCH_SIZE = 30
const BUSY_POLL_INTERVAL_MS = 2000

function terminalScanFilter(siteId: string) {
  return pbAnd([
    pbRelation('site', siteId),
    pbOr(TERMINAL_SCAN_STATUSES.map(status => pbSelect('status', status)))
  ])
}

function activeScanFilter(siteId: string) {
  return pbAnd([
    pbRelation('site', siteId),
    pbOr(ACTIVE_SCAN_STATUSES.map(status => pbSelect('status', status)))
  ])
}

function isActiveScanStatus(status: string | undefined) {
  return status === 'running' || status === 'background_scan'
}

type QueueRow = { status?: string }

/** Pending only. `processing` means the worker started and counts as scanning. */
function applyQueueFlags(queueItems: QueueRow[]) {
  const isQueued = queueItems.some(item => item.status === 'pending')
  const isStarting = queueItems.some(item => item.status === 'processing')
  return { isQueued, isStarting }
}

async function fetchLastTerminalScan(
  pb: NonNullable<ReturnType<typeof usePocketBase>['pb']>,
  siteId: string
): Promise<Scan | null> {
  try {
    const focused = await pb.collection('scans').getList(1, 1, {
      filter: terminalScanFilter(siteId),
      sort: SCAN_LIST_SORT
    })
    const direct = focused.items[0] as Scan | undefined
    if (direct) return direct
  } catch {
    // Fall back to client-side pick below.
  }

  try {
    const broad = await pb.collection('scans').getList(1, TERMINAL_SCAN_FETCH_SIZE, {
      filter: pbRelation('site', siteId),
      sort: SCAN_LIST_SORT
    })
    return pickLatestTerminalScan(broad.items as unknown as Scan[])
  } catch {
    return null
  }
}

/** Active-site scan state for the workspace switcher (queue + running + latest terminal scan). */
export function useWorkspaceScanState(siteId: Ref<string | undefined>) {
  const { pb, awaitAuthReady } = usePocketBase()
  const authReady = useState('pb-auth-ready', () => false)
  const isQueued = ref(false)
  const isRunning = ref(false)
  const runningScan = ref<Scan | null>(null)
  const lastTerminalScan = ref<Scan | null>(null)
  const loadError = ref(false)

  const displayState = computed((): WorkspaceScanState =>
    deriveWorkspaceScanState({
      siteId: siteId.value,
      isQueued: isQueued.value,
      isRunning: isRunning.value,
      lastTerminalScan: lastTerminalScan.value
    })
  )

  const isBusy = computed(() => isQueued.value || isRunning.value)

  let unsubscribeQueue: (() => void) | null = null
  let unsubscribeScans: (() => void) | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startPolling() {
    stopPolling()
    pollTimer = setInterval(() => {
      refresh({ silent: true }).catch(() => {})
    }, BUSY_POLL_INTERVAL_MS)
  }

  function applyQueueEvent(action: string, status: string | undefined) {
    if (action === 'delete') {
      isQueued.value = false
      return
    }
    if (status === 'pending') {
      isQueued.value = true
      return
    }
    if (status === 'processing') {
      isQueued.value = false
      isRunning.value = true
    }
  }

  async function refresh(options?: { silent?: boolean }) {
    const id = siteId.value
    if (!id || !pb) {
      isQueued.value = false
      isRunning.value = false
      runningScan.value = null
      lastTerminalScan.value = null
      loadError.value = false
      stopPolling()
      return
    }

    if (!options?.silent && awaitAuthReady) {
      await awaitAuthReady()
    }

    loadError.value = false

    const [pendingResult, runningResult, terminalScan] = await Promise.all([
      pb.collection('scan_queue').getList(1, 5, {
        filter: pbAnd([
          pbRelation('site', id),
          pbOr([pbSelect('status', 'pending'), pbSelect('status', 'processing')])
        ])
      }).then(r => ({ ok: true as const, items: r.items as QueueRow[] })).catch(() => ({ ok: false as const, items: [] as QueueRow[] })),
      pb.collection('scans').getList(1, 1, {
        filter: activeScanFilter(id),
        sort: SCAN_LIST_SORT
      }).then(r => ({ ok: true as const, items: r.items })).catch(() => ({ ok: false as const, items: [] })),
      fetchLastTerminalScan(pb, id)
        .then(scan => ({ ok: true as const, scan }))
        .catch(() => ({ ok: false as const, scan: null as Scan | null }))
    ])

    if (!pendingResult.ok || !runningResult.ok || !terminalScan.ok) {
      loadError.value = true
    }

    const queueFlags = applyQueueFlags(pendingResult.items)
    isQueued.value = queueFlags.isQueued
    isRunning.value = runningResult.items.length > 0 || queueFlags.isStarting
    runningScan.value = (runningResult.items[0] as Scan | undefined) ?? null
    lastTerminalScan.value = terminalScan.scan

    if (isQueued.value || isRunning.value) {
      startPolling()
    } else {
      stopPolling()
    }
  }

  watch(isBusy, (busy) => {
    if (busy) startPolling()
    else stopPolling()
  })

  watch(authReady, (ready) => {
    if (ready && siteId.value) {
      refresh({ silent: true }).catch(() => {})
    }
  })

  watch(siteId, async (id) => {
    stopPolling()
    if (unsubscribeQueue) {
      unsubscribeQueue()
      unsubscribeQueue = null
    }
    if (unsubscribeScans) {
      unsubscribeScans()
      unsubscribeScans = null
    }
    await refresh()
    if (!id || !pb) return

    unsubscribeQueue = await pb.collection('scan_queue').subscribe('*', (e) => {
      const record = e.record as { site?: string, status?: string }
      if (record.site !== id) return
      applyQueueEvent(e.action, record.status)
      refresh({ silent: true }).catch(() => {})
    })

    unsubscribeScans = await pb.collection('scans').subscribe('*', (e) => {
      const record = e.record as { site?: string, status?: string }
      if (record.site !== id) return
      if (e.action === 'create' || e.action === 'update') {
        if (isActiveScanStatus(record.status)) {
          isQueued.value = false
          isRunning.value = true
        } else if (record.status && TERMINAL_SCAN_STATUSES.includes(record.status as typeof TERMINAL_SCAN_STATUSES[number])) {
          isRunning.value = false
        }
      }
      refresh({ silent: true }).catch(() => {})
    })
  }, { immediate: true })

  if (getCurrentInstance()) {
    onUnmounted(() => {
      stopPolling()
      if (unsubscribeQueue) unsubscribeQueue()
      if (unsubscribeScans) unsubscribeScans()
    })
  }

  return {
    isQueued,
    isRunning,
    isBusy,
    runningScan,
    lastTerminalScan,
    displayState,
    loadError,
    refresh
  }
}

function _useActiveWorkspaceScanState() {
  const { activeSiteId } = useSites()
  const siteIdRef = computed(() => activeSiteId.value || undefined)
  return useWorkspaceScanState(siteIdRef)
}

/** Shared scan state for the sidebar workspace switcher (single subscription per session). */
export const useActiveWorkspaceScanState = createSharedComposable(_useActiveWorkspaceScanState)
