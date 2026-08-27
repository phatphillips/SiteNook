/**
 * Shared pending state for accessibility score refreshes after issue status changes.
 * Overview components can show a loading cue while reconcile / background work runs.
 */
export function useA11yScoreRefresh() {
  const pendingBySite = useState<Record<string, number>>('a11y-score-refresh-pending', () => ({}))
  const historyRevision = useState('a11y-issue-history-revision', () => 0)

  function beginScoreRefresh(siteId: string) {
    if (!siteId) return
    const current = pendingBySite.value[siteId] ?? 0
    pendingBySite.value = { ...pendingBySite.value, [siteId]: current + 1 }
  }

  function endScoreRefresh(siteId: string) {
    if (!siteId) return
    const current = pendingBySite.value[siteId] ?? 0
    if (current <= 1) {
      const next = { ...pendingBySite.value }
      delete next[siteId]
      pendingBySite.value = next
      return
    }
    pendingBySite.value = { ...pendingBySite.value, [siteId]: current - 1 }
  }

  function isScoreRefreshing(siteId: string | Ref<string> | ComputedRef<string>) {
    return computed(() => {
      const id = typeof siteId === 'string' ? siteId : siteId.value
      return (pendingBySite.value[id] ?? 0) > 0
    })
  }

  function bumpHistoryRevision() {
    historyRevision.value += 1
  }

  return {
    pendingBySite,
    historyRevision,
    beginScoreRefresh,
    endScoreRefresh,
    isScoreRefreshing,
    bumpHistoryRevision
  }
}
