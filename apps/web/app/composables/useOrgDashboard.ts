import type { Scan, Site } from '~/types/sitenook'
import {
  aggregateOrgDashboard,
  buildSiteDashboardSnapshot,
  type OrgDashboardAggregates
} from '~/utils/dashboardAggregates'
import { pbAnd, pbOr, pbRelation, pbSelect } from '~/utils/pbFilter'
import { SCAN_LIST_SORT, TERMINAL_SCAN_STATUSES } from '~/utils/scanDisplay'

const LATEST_SCAN_FIELDS
  = 'id,site,status,completed_at,started_at,created,score_overall,score_qa,score_seo,open_issue_count'

async function fetchLatestTerminalScan(
  pb: NonNullable<ReturnType<typeof usePocketBase>['pb']>,
  siteId: string
): Promise<Scan | null> {
  const filter = pbAnd([
    pbRelation('site', siteId),
    pbOr(TERMINAL_SCAN_STATUSES.map(status => pbSelect('status', status)))
  ])

  try {
    const result = await pb.collection('scans').getList(1, 1, {
      filter,
      sort: SCAN_LIST_SORT,
      fields: LATEST_SCAN_FIELDS
    })
    return (result.items[0] as Scan | undefined) ?? null
  } catch {
    return null
  }
}

async function countForScan(
  pb: NonNullable<ReturnType<typeof usePocketBase>['pb']>,
  collection: string,
  scanId: string,
  extraFilter?: string
): Promise<number> {
  const clauses = [pbRelation('scan', scanId)]
  if (extraFilter) clauses.push(extraFilter)

  try {
    const result = await pb.collection(collection).getList(1, 1, {
      filter: pbAnd(clauses),
      fields: 'id'
    })
    return result.totalItems
  } catch {
    return 0
  }
}

async function buildSnapshotForSite(
  pb: NonNullable<ReturnType<typeof usePocketBase>['pb']>,
  site: Site
) {
  const latestScan = await fetchLatestTerminalScan(pb, site.id)
  if (!latestScan?.id) {
    return buildSiteDashboardSnapshot({
      site,
      latestScan: null,
      openA11yIssues: site.current_a11y?.open_issue_count ?? 0,
      openQaIssues: 0,
      openSeoIssues: 0,
      brokenLinkCount: 0,
      misspellingCount: 0,
      technicalSeoCount: 0,
      contentSeoCount: 0
    })
  }

  const [brokenLinks, misspellings, technicalSeo, contentSeo] = await Promise.all([
    countForScan(pb, 'qa_broken_links', latestScan.id),
    countForScan(pb, 'qa_spelling', latestScan.id),
    countForScan(pb, 'seo_issues', latestScan.id, `status = 'open' && category = 'technical'`),
    countForScan(pb, 'seo_issues', latestScan.id, `status = 'open' && category = 'content'`)
  ])

  return buildSiteDashboardSnapshot({
    site,
    latestScan,
    openA11yIssues: latestScan.open_issue_count ?? site.current_a11y?.open_issue_count ?? 0,
    openQaIssues: brokenLinks + misspellings,
    openSeoIssues: technicalSeo + contentSeo,
    brokenLinkCount: brokenLinks,
    misspellingCount: misspellings,
    technicalSeoCount: technicalSeo,
    contentSeoCount: contentSeo
  })
}

export function useOrgDashboard() {
  const { pb, awaitAuthReady, syncAuth } = usePocketBase()
  const { sites, fetchSites } = useSites()
  const config = useRuntimeConfig()
  const useSummaryRead = String(config.public.dashboardRollupsRead || 'false') === 'true'

  const loading = ref(false)
  const aggregates = ref<OrgDashboardAggregates | null>(null)
  const loadError = ref<string | null>(null)
  const dataAsOf = ref<string | null>(null)
  const source = ref<'summary' | 'fallback' | 'mixed' | null>(null)

  async function fetchOrgDashboard(options?: { silent?: boolean }) {
    await awaitAuthReady()
    syncAuth()
    if (!pb?.authStore.isValid) return

    if (!options?.silent) {
      loading.value = true
    }
    loadError.value = null

    try {
      if (useSummaryRead) {
        const token = pb.authStore.token
        if (!token) throw new Error('Authentication required')
        const response = await $fetch<{
          aggregates: OrgDashboardAggregates
          source: 'summary' | 'fallback' | 'mixed'
          dataAsOf: string | null
        }>('/api/org-dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        })
        aggregates.value = response.aggregates
        source.value = response.source
        dataAsOf.value = response.dataAsOf
        return
      }

      if (!sites.value.length) {
        await fetchSites()
      }

      const snapshots = await Promise.all(
        sites.value.map(site => buildSnapshotForSite(pb, site))
      )
      aggregates.value = aggregateOrgDashboard(snapshots)
      source.value = 'fallback'
      dataAsOf.value = null
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Failed to load org dashboard'
      aggregates.value = aggregateOrgDashboard([])
      source.value = null
      dataAsOf.value = null
    } finally {
      if (!options?.silent) {
        loading.value = false
      }
    }
  }

  return {
    loading,
    aggregates,
    loadError,
    dataAsOf,
    source,
    fetchOrgDashboard
  }
}
