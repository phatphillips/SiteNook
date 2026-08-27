import type PocketBase from 'pocketbase'
import type { Scan } from '~/types/sitenook'
import {
  buildDisplayScansFilter,
  pickDisplayScan,
  sortScansForDisplay
} from '~/utils/scanDisplay'

export interface ResolvedOrgSite {
  siteId: string
  name: string
  url: string
  latestScanId: string | null
  latestScan: Scan | null
}

const SITE_FIELDS = 'id,name,url,site_settings'

export async function resolveOrgSites(
  pb: PocketBase,
  orgId: string,
  options?: { siteId?: string }
): Promise<ResolvedOrgSite[]> {
  const filter = options?.siteId
    ? `organization = "${orgId}" && id = "${options.siteId}"`
    : `organization = "${orgId}"`

  const sites = await pb.collection('sites').getFullList({
    filter,
    sort: 'name',
    fields: SITE_FIELDS
  }) as Array<{ id: string, name: string, url: string }>

  const resolved = await Promise.all(
    sites.map(async (site) => {
      const scanList = await pb.collection('scans').getFullList({
        filter: buildDisplayScansFilter(site.id),
        fields: 'id,site,status,completed_at,started_at,created,score_overall,score_qa,score_seo,score_seo_technical,score_seo_content,seo_crawl_audit'
      }) as unknown as Scan[]
      const latestScan = pickDisplayScan(sortScansForDisplay(scanList))
      return {
        siteId: site.id,
        name: site.name,
        url: site.url,
        latestScanId: latestScan?.id ?? null,
        latestScan
      }
    })
  )

  return resolved
}

export function paginateMerged<T>(
  items: T[],
  page: number,
  perPage: number
): { items: T[], total: number, page: number, perPage: number } {
  const safePage = Math.max(1, page)
  const safePerPage = Math.min(200, Math.max(1, perPage))
  const start = (safePage - 1) * safePerPage
  return {
    items: items.slice(start, start + safePerPage),
    total: items.length,
    page: safePage,
    perPage: safePerPage
  }
}

export function parseOrgListQuery(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(200, Math.max(1, Number(query.perPage) || 50))
  const siteId = typeof query.siteId === 'string' && query.siteId.trim()
    ? query.siteId.trim()
    : undefined
  const hrefQuery = typeof query.hrefQuery === 'string' ? query.hrefQuery.trim() : undefined
  const category = typeof query.category === 'string' ? query.category.trim() : undefined
  return { page, perPage, siteId, hrefQuery, category }
}
