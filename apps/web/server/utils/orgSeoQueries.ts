import type PocketBase from 'pocketbase'
import type { SeoIssue } from '~/types/sitenook'
import { pbRelation } from '~/utils/pbFilter'
import { filterSeoIssues } from '~/utils/seoIssues'
import { paginateMerged, resolveOrgSites } from './orgSites'

export interface OrgSeoIssueRow extends SeoIssue {
  siteId: string
  siteName: string
}

export async function queryOrgSeoIssues(
  pb: PocketBase,
  orgId: string,
  options: {
    siteId?: string
    category?: 'technical' | 'content'
    page: number
    perPage: number
  }
) {
  const sites = await resolveOrgSites(pb, orgId, { siteId: options.siteId })
  const merged: OrgSeoIssueRow[] = []

  for (const site of sites) {
    if (!site.latestScanId) continue
    const issues = await pb.collection('seo_issues').getFullList({
      filter: `${pbRelation('scan', site.latestScanId)} && status = 'open'`,
      expand: 'page'
    }) as unknown as SeoIssue[]
    const filtered = options.category
      ? filterSeoIssues(issues, { category: options.category })
      : issues
    for (const issue of filtered) {
      merged.push({ ...issue, siteId: site.siteId, siteName: site.name })
    }
  }

  merged.sort((a, b) => (a.rule_id ?? '').localeCompare(b.rule_id ?? ''))
  return paginateMerged(merged, options.page, options.perPage)
}
