import { subDays } from 'date-fns'
import type { Scan } from '~/types/sitenook'
import { pbAnd, pbOr, pbRelation, pbSelect } from '~/utils/pbFilter'
import { buildOrgAverageDailyTrend, type TrendPoint } from '~/utils/scanTrendSeries'

const SCORE_TREND_FIELDS =
  'id,site,status,completed_at,started_at,created,score_overall,score_a,score_aa,score_aaa,score_best_practices,open_issue_count'

/** Glance card stays on a fixed 30-day org-average overall series. */
const COLLAPSED_TREND_DAYS = 30

/**
 * Loads completed scans across sites for org accessibility score trends.
 * Collapsed card uses a 30-day overall average; raw scans support the expand modal (up to 12mo).
 */
export function useOrgA11yScoreTrend(siteIds: Ref<string[]>) {
  const { pb, awaitAuthReady } = usePocketBase()

  const points = ref<TrendPoint[]>([])
  const scans = ref<Scan[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)

  async function fetchTrend() {
    const ids = siteIds.value.filter(Boolean)
    if (!ids.length || !pb) {
      points.value = []
      scans.value = []
      return
    }

    loading.value = true
    loadError.value = null
    try {
      await awaitAuthReady()
      // ~13 months so 12mo modal range can carry scores forward from before the window.
      const since = subDays(new Date(), 400).toISOString()
      const siteFilter = pbOr(ids.map(id => pbRelation('site', id)))
      const statusFilter = pbOr([
        pbSelect('status', 'complete'),
        pbSelect('status', 'complete_with_errors')
      ])
      const filter = pbAnd([
        siteFilter,
        statusFilter,
        `completed_at >= "${since}"`
      ])

      const loaded = await pb.collection('scans').getFullList({
        filter,
        fields: SCORE_TREND_FIELDS,
        sort: 'completed_at'
      }) as unknown as Scan[]

      scans.value = loaded
      points.value = buildOrgAverageDailyTrend(
        loaded,
        scan => scan.score_overall ?? null,
        COLLAPSED_TREND_DAYS
      )
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Failed to load score trend'
      points.value = []
      scans.value = []
    } finally {
      loading.value = false
    }
  }

  watch(siteIds, () => {
    void fetchTrend()
  }, { deep: true, immediate: true })

  return {
    points,
    scans,
    loading,
    loadError,
    fetchTrend
  }
}
