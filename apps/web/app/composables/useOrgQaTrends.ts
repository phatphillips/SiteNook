import { subDays } from 'date-fns'
import type { Scan } from '~/types/sitenook'
import { hydrateScanBrokenLinkCounts } from '~/utils/hydrateScanBrokenLinkCounts'
import { pbAnd, pbOr, pbRelation, pbSelect } from '~/utils/pbFilter'
import {
  buildOrgAverageDailyTrend,
  buildOrgSumDailyTrend,
  type TrendPoint
} from '~/utils/scanTrendSeries'

const QA_SCORE_TREND_FIELDS
  = 'id,site,status,completed_at,started_at,created,score_qa,broken_link_count'

/** Glance card stays on a fixed 30-day org-average QA score series. */
const COLLAPSED_TREND_DAYS = 30

/**
 * Loads completed scans across sites for org QA score trends.
 * Collapsed card uses a 30-day average; raw scans support the expand modal (up to 12mo).
 */
export function useOrgQaScoreTrend(siteIds: Ref<string[]>) {
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
        fields: QA_SCORE_TREND_FIELDS,
        sort: 'completed_at'
      }) as unknown as Scan[]

      scans.value = loaded
      points.value = buildOrgAverageDailyTrend(
        loaded,
        scan => scan.score_qa ?? null,
        COLLAPSED_TREND_DAYS
      )
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Failed to load QA score trend'
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

/**
 * Loads completed scans for org broken-links stock trends.
 * Hydrates missing `broken_link_count` from qa_broken_links for older scans.
 */
export function useOrgQaBrokenLinksTrend(siteIds: Ref<string[]>) {
  const { pb, awaitAuthReady } = usePocketBase()

  const points = ref<TrendPoint[]>([])
  const scans = ref<Scan[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)

  const latestBrokenLinkCount = computed(() => {
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
        fields: QA_SCORE_TREND_FIELDS,
        sort: 'completed_at'
      }) as unknown as Scan[]

      const hydrated = await hydrateScanBrokenLinkCounts(pb, loaded)
      scans.value = hydrated
      points.value = buildOrgSumDailyTrend(
        hydrated,
        scan => scan.broken_link_count ?? null,
        COLLAPSED_TREND_DAYS
      )
    } catch (error) {
      loadError.value = error instanceof Error
        ? error.message
        : 'Failed to load broken links trend'
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
    latestBrokenLinkCount,
    loading,
    loadError,
    fetchTrend
  }
}
