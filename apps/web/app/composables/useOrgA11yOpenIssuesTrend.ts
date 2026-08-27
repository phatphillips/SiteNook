import { subDays } from 'date-fns'
import type { Scan } from '~/types/sitenook'
import { pbAnd, pbOr, pbRelation, pbSelect } from '~/utils/pbFilter'
import {
  buildOrgSumDailyTrend,
  type TrendPoint
} from '~/utils/scanTrendSeries'

const OPEN_ISSUES_TREND_FIELDS
  = 'id,site,status,completed_at,started_at,created,open_issue_count'

/** Glance card stays on a fixed 30-day org-sum open-issues series. */
const COLLAPSED_TREND_DAYS = 30

/**
 * Loads completed scans for org open-issue stock trends.
 * Collapsed card: 30-day sum; raw scans support expand modal (up to 12mo).
 */
export function useOrgA11yOpenIssuesTrend(siteIds: Ref<string[]>) {
  const { pb, awaitAuthReady } = usePocketBase()

  const points = ref<TrendPoint[]>([])
  const scans = ref<Scan[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)

  const latestOpenCount = computed(() => {
    for (let i = points.value.length - 1; i >= 0; i--) {
      const value = points.value[i]?.value
      if (value != null) return value
    }
    return 0
  })

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
      // ~13 months so 12mo modal range can carry counts forward from before the window.
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
        fields: OPEN_ISSUES_TREND_FIELDS,
        sort: 'completed_at'
      }) as unknown as Scan[]

      scans.value = loaded
      points.value = buildOrgSumDailyTrend(
        loaded,
        scan => scan.open_issue_count ?? null,
        COLLAPSED_TREND_DAYS
      )
    } catch (error) {
      loadError.value = error instanceof Error
        ? error.message
        : 'Failed to load open issues trend'
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
    latestOpenCount,
    loading,
    loadError,
    fetchTrend
  }
}
