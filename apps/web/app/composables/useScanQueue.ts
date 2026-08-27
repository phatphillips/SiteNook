import type { Ref } from 'vue'
import { useWorkspaceScanState } from '~/composables/useWorkspaceScanState'

/** Per-site queue/running flags (used by scan trigger and other site-scoped controls). */
export function useScanQueueStatus(siteId: Ref<string | undefined>) {
  const { isQueued, isRunning, isBusy, refresh } = useWorkspaceScanState(siteId)
  return { isQueued, isRunning, isBusy, refresh }
}
