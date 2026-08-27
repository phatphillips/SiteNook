import type { AccessibilityIssue, Scan } from '~/types/sitenook'
import type { A11yIssuesApiResponse } from '~/composables/useA11yIssuesPage'
import { buildDisplayScansFilter, pickDisplayScan, pickLatestTrustedScan } from '~/utils/scanDisplay'
import { preferStoredScanScore } from '~/utils/scanScores'
import type { A11ySummary } from '~/utils/a11ySummary'
import {
  calculateAccessibilityScores,
  scoreableIssues
} from '~/utils/a11yScoring'

/**
 * Lightweight accessibility data for dashboard overview cards — no full issue dumps.
 */
export function useAccessibilitySummary(siteId: Ref<string> | string) {
  const { pb, awaitAuthReady } = usePocketBase()
  const { sites } = useSites()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const scans = ref<Scan[]>([])
  const previewIssues = ref<AccessibilityIssue[]>([])
  const currentA11y = ref<A11ySummary | null>(null)
  const loading = ref(false)
  const openIssueCount = ref(0)
  const pointsToGainByRule = ref<Map<string, number>>(new Map())

  const scoreElementTotals = computed(() => {
    const site = sites.value.find(s => s.id === id.value)
    return site?.score_denominators?.elements
  })

  const scoreableTargetIssues = computed(() => scoreableIssues(previewIssues.value))

  const overallScore = computed(() =>
    calculateAccessibilityScores(
      scoreableTargetIssues.value,
      scoreElementTotals.value,
      pickLatestTrustedScan(scans.value)?.a11y_check_stats
    ).overall
  )

  const displayScore = computed(() => {
    const scan = pickDisplayScan(
      scans.value.filter(s => s.status === 'complete' || s.status === 'complete_with_errors')
    )
    return preferStoredScanScore(scan?.score_overall, overallScore.value)
  })

  async function fetchSummary() {
    if (!id.value || !pb) return
    loading.value = true
    try {
      await awaitAuthReady()
      const token = pb.authStore.token

      const [scanList, siteRecord] = await Promise.all([
        pb.collection('scans').getFullList({
          filter: buildDisplayScansFilter(id.value),
          fields: 'id,site,status,completed_at,started_at,created,score_overall'
        }),
        pb.collection('sites').getOne(id.value, { fields: 'current_a11y,score_denominators' }) as Promise<{
          current_a11y?: A11ySummary | null
        }>
      ])

      scans.value = scanList as unknown as Scan[]
      currentA11y.value = siteRecord.current_a11y ?? null
      openIssueCount.value = currentA11y.value?.open_issue_count ?? 0

      if (!token) {
        previewIssues.value = []
        return
      }

      const response = await $fetch<A11yIssuesApiResponse>(
        `/api/sites/${id.value}/accessibility/issues`,
        {
          headers: { Authorization: `Bearer ${token}` },
          query: {
            page: 1,
            perPage: 5,
            statuses: 'open'
          }
        }
      )

      previewIssues.value = response.items
      openIssueCount.value = response.openUniqueCount ?? response.total
      pointsToGainByRule.value = new Map(Object.entries(response.pointsToGainByRule ?? {}))
    } catch (err) {
      console.error('[useAccessibilitySummary] fetch failed', err)
      previewIssues.value = []
    } finally {
      loading.value = false
    }
  }

  watch(id, () => {
    void fetchSummary()
  }, { immediate: true })

  return {
    scans,
    previewIssues,
    currentA11y,
    loading,
    openIssueCount,
    displayScore,
    overallScore,
    scoreableTargetIssues,
    scoreElementTotals,
    pointsToGainByRule,
    fetchSummary
  }
}
