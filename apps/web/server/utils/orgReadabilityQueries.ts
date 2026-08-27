import type PocketBase from 'pocketbase'
import type { PageRecord } from '~/types/sitenook'
import { resolvePageReadabilityScores } from '~/utils/readabilityScoring'
import type { ReadabilityMethodId, ReadabilityPageRow } from '~/utils/readabilityMethods'
import { bucketForScore } from '~/utils/readabilityDistribution'
import { resolveOrgSites } from './orgSites'
import {
  buildLatestScansFilter,
  emptyOrgList
} from './orgScanFilters'

const READABILITY_PAGE_FIELDS =
  'id,url,title,word_count,readability_score,readability_scores,scan,site,created'

const READABILITY_SUMMARY_FIELDS =
  'readability_score,readability_scores,word_count'

export interface OrgReadabilityPageRow extends ReadabilityPageRow {
  siteId: string
  siteName: string
}

function toReadabilityPageRow(page: PageRecord): ReadabilityPageRow {
  return {
    id: page.id,
    url: page.url,
    title: page.title ?? '',
    word_count: page.word_count ?? 0,
    scores: resolvePageReadabilityScores({
      readability_scores: page.readability_scores,
      readability_score: page.readability_score
    })
  }
}

export async function queryOrgReadabilityPages(
  pb: PocketBase,
  orgId: string,
  options: {
    siteId?: string
    page: number
    perPage: number
    methodId?: ReadabilityMethodId
    bucketId?: string
  }
) {
  const sites = await resolveOrgSites(pb, orgId, { siteId: options.siteId })
  const scanFilter = buildLatestScansFilter(sites)
  if (!scanFilter) return emptyOrgList<OrgReadabilityPageRow>(options.page, options.perPage)

  const siteById = new Map(sites.map(site => [site.siteId, site]))
  const hasBucketFilter = !!options.methodId && !!options.bucketId

  if (!hasBucketFilter) {
    const result = await pb.collection('pages').getList(options.page, options.perPage, {
      filter: scanFilter,
      fields: READABILITY_PAGE_FIELDS,
      sort: 'url'
    })

    const items = (result.items as unknown as PageRecord[]).map((page) => {
      const siteId = typeof page.site === 'string' ? page.site : page.site ?? ''
      const site = siteById.get(siteId)
      return {
        ...toReadabilityPageRow(page),
        siteId: site?.siteId ?? siteId,
        siteName: site?.name ?? '—'
      }
    })

    return {
      items,
      total: result.totalItems,
      page: options.page,
      perPage: options.perPage
    }
  }

  const allPages = await pb.collection('pages').getFullList({
    filter: scanFilter,
    fields: READABILITY_PAGE_FIELDS,
    sort: 'url'
  }) as unknown as PageRecord[]

  const filteredRows = allPages
    .map((page) => {
      const siteId = typeof page.site === 'string' ? page.site : page.site ?? ''
      const site = siteById.get(siteId)
      return {
        ...toReadabilityPageRow(page),
        siteId: site?.siteId ?? siteId,
        siteName: site?.name ?? '—'
      }
    })
    .filter((row) => {
      const methodId = options.methodId!
      const bucket = bucketForScore(methodId, row.scores[methodId])
      return bucket?.id === options.bucketId
    })

  const start = (options.page - 1) * options.perPage
  const end = start + options.perPage

  return {
    items: filteredRows.slice(start, end),
    total: filteredRows.length,
    page: options.page,
    perPage: options.perPage
  }
}

export async function queryOrgReadabilitySummary(
  pb: PocketBase,
  orgId: string,
  options: { siteId?: string }
): Promise<{ pages: ReadabilityPageRow[] }> {
  const sites = await resolveOrgSites(pb, orgId, { siteId: options.siteId })
  const scanFilter = buildLatestScansFilter(sites)
  if (!scanFilter) return { pages: [] }

  const pages = await pb.collection('pages').getFullList({
    filter: scanFilter,
    fields: READABILITY_SUMMARY_FIELDS
  }) as unknown as PageRecord[]

  return {
    pages: pages.map(toReadabilityPageRow)
  }
}
