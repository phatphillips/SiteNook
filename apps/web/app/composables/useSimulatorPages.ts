import type { AccessibilityIssue, Scan } from '~/types/sitenook'
import { attachPageMetaToIssues, pageUrlMapFromRows, type A11yPageRow } from '~/utils/a11yPageMeta'
import { A11Y_ISSUE_LIST_FIELDS, A11Y_PAGE_FIELDS } from '~/utils/a11yQueryFields'
import { pbRelation } from '~/utils/pbFilter'
import { latestPageIdsByNormalizedUrl } from '~/utils/pageUrl'
import { scanTimestamp } from '~/utils/scanDisplay'
import {
  buildSimulatorPageRows,
  impactRank,
  type SimulatorPageRow
} from '~/utils/simulatorPages'

function scanActivityTimestamp(scan: Scan): number {
  const raw = scanTimestamp(scan)
  if (!raw) return 0
  const ms = Date.parse(String(raw))
  return Number.isFinite(ms) ? ms : 0
}

function pageActivityTimestamp(page: A11yPageRow): number {
  const scan = page.expand?.scan
  if (scan) return scanActivityTimestamp(scan)
  if (page.created) {
    const ms = Date.parse(page.created)
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

function latestPageIdsByUrl(pages: A11yPageRow[]): Set<string> {
  return latestPageIdsByNormalizedUrl(
    pages.map(page => ({
      id: page.id,
      url: page.url,
      ts: pageActivityTimestamp(page)
    }))
  )
}

async function loadOpenIssuesForSite(
  pb: ReturnType<typeof usePocketBase>['pb'],
  siteId: string
): Promise<AccessibilityIssue[]> {
  if (!pb) return []

  const pages = await pb.collection('pages').getFullList({
    filter: pbRelation('site', siteId),
    expand: 'scan',
    fields: A11Y_PAGE_FIELDS
  }) as unknown as A11yPageRow[]

  const allowedPageIds = latestPageIdsByUrl(pages)
  if (!allowedPageIds.size) return []

  const pageById = pageUrlMapFromRows(pages)
  const allIssues = await pb.collection('accessibility_issues').getFullList({
    filter: `${pbRelation('scan.site', siteId)} && status = "open"`,
    fields: A11Y_ISSUE_LIST_FIELDS
  }) as unknown as AccessibilityIssue[]

  const latestIssues = allIssues.filter(issue => allowedPageIds.has(issue.page))
  attachPageMetaToIssues(latestIssues, pageById)
  return latestIssues
}

/**
 * Loads pages-with-open-issues for the Accessibility Simulator list.
 * Pass a site id for site scope, or null for all org sites.
 */
export function useSimulatorPages(siteId: MaybeRefOrGetter<string | null | undefined>) {
  const { sites, fetchSites } = useSites()
  const { pb, awaitAuthReady, syncAuth } = usePocketBase()

  const loading = ref(false)
  const error = ref<string | null>(null)
  const rows = ref<SimulatorPageRow[]>([])

  const resolvedSiteId = computed(() => {
    const id = toValue(siteId)
    return id && id !== 'all' ? id : null
  })

  const siteNameById = computed(() =>
    Object.fromEntries(sites.value.map(s => [s.id, s.name]))
  )

  async function load() {
    loading.value = true
    error.value = null
    try {
      await awaitAuthReady()
      syncAuth()
      await fetchSites()

      const targetIds = resolvedSiteId.value
        ? [resolvedSiteId.value]
        : sites.value.map(s => s.id)

      if (!targetIds.length || !pb) {
        rows.value = []
        return
      }

      const batches = await Promise.all(
        targetIds.map(async (id) => {
          const issues = await loadOpenIssuesForSite(pb, id)
          return buildSimulatorPageRows(issues, {
            siteId: id,
            siteNameById: siteNameById.value
          })
        })
      )

      rows.value = batches.flat().sort((a, b) => {
        const impactDiff = impactRank(b.highestImpact) - impactRank(a.highestImpact)
        if (impactDiff !== 0) return impactDiff
        return b.issueCount - a.issueCount
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      rows.value = []
    } finally {
      loading.value = false
    }
  }

  return {
    rows,
    loading,
    error,
    siteNameById,
    load,
    resolvedSiteId
  }
}
