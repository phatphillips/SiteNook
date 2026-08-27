import { subDays } from 'date-fns'
import type { Scan } from '~/types/sitenook'
import { hydrateScanSeoIssueCounts } from '~/utils/hydrateScanSeoIssueCounts'
import { pbAnd, pbOr, pbRelation, pbSelect } from '~/utils/pbFilter'
import {
  buildOrgAverageDailyTrend,
  buildOrgSumDailyTrend,
  type TrendPoint
} from '~/utils/scanTrendSeries'

const SEO_TREND_FIELDS
  = 'id,site,status,completed_at,started_at,created,score_seo,score_seo_technical,score_seo_content,score_seo_crawlability'

/** Glance card stays on a fixed 30-day org-average SEO score series. */
const COLLAPSED_TREND_DAYS = 30

async function loadSeoTrendScans(
  pb: NonNullable<ReturnType<typeof usePocketBase>['pb']>,
  siteIds: string[]
): Promise<Scan[]> {
  const since = subDays(new Date(), 400).toISOString()
  const siteFilter = pbOr(siteIds.map(id => pbRelation('site', id)))
  const statusFilter = pbOr([
    pbSelect('status', 'complete'),
    pbSelect('status', 'complete_with_errors')
  ])
  const filter = pbAnd([
    siteFilter,
    statusFilter,
    `completed_at >= "${since}"`
  ])

  return await pb.collection('scans').getFullList({
    filter,
    fields: SEO_TREND_FIELDS,
    sort: 'completed_at'
  }) as unknown as Scan[]
}

/**
 * Loads completed scans across sites for org SEO score trends.
 * Collapsed card uses a 30-day average; raw scans support the expand modal (up to 12mo).
 */
export function useOrgSeoScoreTrend(siteIds: Ref<string[]>) {
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
      const loaded = await loadSeoTrendScans(pb, ids)
      scans.value = loaded
      points.value = buildOrgAverageDailyTrend(
        loaded,
        scan => scan.score_seo ?? null,
        COLLAPSED_TREND_DAYS
      )
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Failed to load SEO score trend'
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
 * Loads completed scans for org open-SEO-issue stock trends.
 * Hydrates `open_seo_count` from seo_issues.
 */
export function useOrgSeoOpenIssuesTrend(siteIds: Ref<string[]>) {
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
      const loaded = await loadSeoTrendScans(pb, ids)
      const collapsedSince = subDays(new Date(), COLLAPSED_TREND_DAYS + 2).getTime()
      const recent = loaded.filter((scan) => {
        const at = scan.completed_at ?? scan.started_at ?? scan.created
        if (!at) return false
        const time = new Date(at).getTime()
        return Number.isFinite(time) && time >= collapsedSince
      })
      const toHydrate = recent.length ? recent : loaded
      const hydratedRecent = await hydrateScanSeoIssueCounts(pb, toHydrate)
      const recentById = new Map(hydratedRecent.map(scan => [scan.id, scan]))
      scans.value = loaded.map(scan => recentById.get(scan.id) ?? scan)
      points.value = buildOrgSumDailyTrend(
        hydratedRecent,
        scan => scan.open_seo_count ?? null,
        COLLAPSED_TREND_DAYS
      )
      loading.value = false

      const remaining = loaded.filter(scan => !recentById.has(scan.id))
      if (remaining.length) {
        const hydratedRest = await hydrateScanSeoIssueCounts(pb, remaining)
        const allById = new Map<string, Scan>([
          ...recentById,
          ...hydratedRest.map(scan => [scan.id, scan] as [string, Scan])
        ])
        scans.value = loaded.map(scan => allById.get(scan.id) ?? scan)
      }
    } catch (error) {
      loadError.value = error instanceof Error
        ? error.message
        : 'Failed to load SEO issues trend'
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
