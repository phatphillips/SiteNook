import type { Ref } from 'vue'

export function useScanQueueStatus(siteId: Ref<string | undefined>) {
  const { pb } = usePocketBase()
  const isQueued = ref(false)

  let unsubscribe: (() => void) | null = null

  async function refresh() {
    const id = siteId.value
    if (!id) {
      isQueued.value = false
      return
    }

    try {
      const pending = await pb.collection('scan_queue').getList(1, 1, {
        filter: `site = "${id}" && (status = "pending" || status = "processing")`,
        sort: '-created'
      })
      isQueued.value = pending.items.length > 0
    } catch {
      isQueued.value = false
    }
  }

  watch(siteId, async (id) => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    await refresh()
    if (!id) return

    unsubscribe = await pb.collection('scan_queue').subscribe('*', async (e) => {
      const record = e.record as { site?: string, status?: string }
      if (record.site !== id) return
      if (e.action === 'create' || e.action === 'update') {
        isQueued.value = record.status === 'pending' || record.status === 'processing'
      }
    })
  }, { immediate: true })

  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
  })

  return { isQueued, refresh }
}
