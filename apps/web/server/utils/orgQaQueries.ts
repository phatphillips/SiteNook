import type PocketBase from 'pocketbase'
import type { BrokenLink, PolicyMatch, SpellingIssue } from '~/types/sitenook'
import { pbAnd, pbContains, pbSelect } from '~/utils/pbFilter'
import { resolveOrgSites } from './orgSites'
import {
  attachSiteFromScan,
  buildLatestScansFilter,
  emptyOrgList,
  scanSiteLookup
} from './orgScanFilters'

export interface OrgBrokenLinkRow extends BrokenLink {
  siteId: string
  siteName: string
}

export interface OrgSpellingRow extends SpellingIssue {
  siteId: string
  siteName: string
}

export interface OrgPolicyMatchRow extends PolicyMatch {
  siteId: string
  siteName: string
}

export async function queryOrgBrokenLinks(
  pb: PocketBase,
  orgId: string,
  options: { siteId?: string, hrefQuery?: string, page: number, perPage: number }
) {
  const sites = await resolveOrgSites(pb, orgId, { siteId: options.siteId })
  const scanFilter = buildLatestScansFilter(sites)
  if (!scanFilter) return emptyOrgList<OrgBrokenLinkRow>(options.page, options.perPage)

  const clauses = [scanFilter, pbSelect('status', 'broken')]
  if (options.hrefQuery) clauses.push(pbContains('href', options.hrefQuery))

  const result = await pb.collection('qa_broken_links').getList(options.page, options.perPage, {
    filter: pbAnd(clauses),
    sort: 'href',
    expand: 'page'
  })

  const lookup = scanSiteLookup(sites)
  return {
    items: attachSiteFromScan(result.items as unknown as BrokenLink[], lookup),
    total: result.totalItems,
    page: options.page,
    perPage: options.perPage
  }
}

export async function queryOrgSpelling(
  pb: PocketBase,
  orgId: string,
  options: { siteId?: string, page: number, perPage: number, confidence?: 'error' | 'review' }
) {
  const sites = await resolveOrgSites(pb, orgId, { siteId: options.siteId })
  const scanFilter = buildLatestScansFilter(sites)
  if (!scanFilter) return emptyOrgList<OrgSpellingRow>(options.page, options.perPage)

  const filter = options.confidence
    ? pbAnd([scanFilter, pbSelect('confidence', options.confidence)])
    : scanFilter

  const result = await pb.collection('qa_spelling').getList(options.page, options.perPage, {
    filter,
    sort: 'word',
    expand: 'page'
  })

  const lookup = scanSiteLookup(sites)
  return {
    items: attachSiteFromScan(result.items as unknown as SpellingIssue[], lookup),
    total: result.totalItems,
    page: options.page,
    perPage: options.perPage
  }
}

export async function queryOrgPolicyMatches(
  pb: PocketBase,
  orgId: string,
  options: {
    siteId?: string
    page: number
    perPage: number
    status?: 'open' | 'dismissed' | 'fixed'
  }
) {
  const sites = await resolveOrgSites(pb, orgId, { siteId: options.siteId })
  const scanFilter = buildLatestScansFilter(sites)
  if (!scanFilter) return emptyOrgList<OrgPolicyMatchRow>(options.page, options.perPage)

  const filter = options.status
    ? pbAnd([scanFilter, pbSelect('status', options.status)])
    : scanFilter

  const result = await pb.collection('policy_matches').getList(options.page, options.perPage, {
    filter,
    // Prefer -created once autodate exists; -id is always present on base collections.
    sort: '-id',
    expand: 'page,policy'
  })

  const lookup = scanSiteLookup(sites)
  return {
    items: attachSiteFromScan(result.items as unknown as PolicyMatch[], lookup),
    total: result.totalItems,
    page: options.page,
    perPage: options.perPage
  }
}
