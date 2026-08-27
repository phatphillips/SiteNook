import { pbOr, pbRelation } from '~/utils/pbFilter'
import type { ResolvedOrgSite } from './orgSites'

export function latestScanIds(sites: ResolvedOrgSite[]): string[] {
  return sites
    .map(site => site.latestScanId)
    .filter((id): id is string => Boolean(id))
}

export function buildLatestScansFilter(sites: ResolvedOrgSite[]): string | null {
  const scanIds = latestScanIds(sites)
  if (!scanIds.length) return null
  return pbOr(scanIds.map(id => pbRelation('scan', id)))
}

export function scanSiteLookup(sites: ResolvedOrgSite[]): Map<string, ResolvedOrgSite> {
  const lookup = new Map<string, ResolvedOrgSite>()
  for (const site of sites) {
    if (site.latestScanId) lookup.set(site.latestScanId, site)
  }
  return lookup
}

export function emptyOrgList<T>(page: number, perPage: number) {
  return { items: [] as T[], total: 0, page, perPage }
}

export function attachSiteFromScan<T extends { scan: string }>(
  items: T[],
  lookup: Map<string, ResolvedOrgSite>
): Array<T & { siteId: string, siteName: string }> {
  return items.map((item) => {
    const site = lookup.get(item.scan)
    return {
      ...item,
      siteId: site?.siteId ?? '',
      siteName: site?.name ?? '—'
    }
  })
}
