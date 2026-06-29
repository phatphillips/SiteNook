import type { Ref } from 'vue'
import { pbAnd, pbOr, pbRelation, pbSelect } from '~/utils/pbFilter'

export function useScanQueueStatus(siteId: Ref<string | undefined>) {
  const { pb } = usePocketBase()
  const isQueued = ref(false)
  const isRunning = ref(false)
  const isBusy = computed(() => isQueued.value || isRunning.value)

  let unsubscribe: (() => void) | null = null
  let unsubscribeScans: (() => void) | null = null

  async function refresh() {
    const id = siteId.value
    if (!id || !pb) {
      isQueued.value = false
      isRunning.value = false
      return
    }

    try {
      const [pending, running] = await Promise.all([
        pb.collection('scan_queue').getList(1, 1, {
          filter: pbAnd([
            pbRelation('site', id),
            pbOr([pbSelect('status', 'pending'), pbSelect('status', 'processing')])
          ])
        }),
        pb.collection('scans').getList(1, 1, {
          filter: pbAnd([pbRelation('site', id), pbSelect('status', 'running')])
        })
      ])
      isQueued.value = pending.items.length > 0
      isRunning.value = running.items.length > 0
    } catch {
      isQueued.value = false
      isRunning.value = false
    }
  }

  watch(siteId, async (id) => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    if (unsubscribeScans) {
      unsubscribeScans()
      unsubscribeScans = null
    }
    await refresh()
    if (!id || !pb) return

    unsubscribe = await pb.collection('scan_queue').subscribe('*', async (e) => {
      const record = e.record as { site?: string, status?: string }
      if (record.site !== id) return
      if (e.action === 'create' || e.action === 'update') {
        isQueued.value = record.status === 'pending' || record.status === 'processing'
      } else if (e.action === 'delete') {
        await refresh()
      }
    })

    unsubscribeScans = await pb.collection('scans').subscribe('*', async (e) => {
      const record = e.record as { site?: string, status?: string }
      if (record.site !== id) return
      if (e.action === 'create' || e.action === 'update') {
        isRunning.value = record.status === 'running'
      } else if (e.action === 'delete') {
        await refresh()
      }
    })
  }, { immediate: true })

  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
    if (unsubscribeScans) unsubscribeScans()
  })

  return { isQueued, isRunning, isBusy, refresh }
}
