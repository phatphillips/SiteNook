import type PocketBase from 'pocketbase'
import type { InventoryPageRow } from '~/types/sitenook'
import { dedupeInventoryRowsByUrl, inventoryRowSizeBytes } from '~/utils/inventoryPages'
import {
  isInventoryImageUrl,
  isInventoryPdfUrl,
  normalizeInventoryUrl
} from '~/utils/inventoryUrl'
import { resolveOrgSites, paginateMerged } from './orgSites'
import { buildLatestScansFilter, emptyOrgList } from './orgScanFilters'
import { buildInventoryAssetTabFilter } from './inventoryAssetFilters'
import {
  fetchPbFullListPerSiteScan,
  buildScanScopedSearchFilter,
  getCachedInventoryList,
  inventoryListCacheKey,
  setCachedInventoryList
} from './inventoryQueryCache'

const INVENTORY_PAGE_FIELDS = 'id,url,scan,site,html_size_bytes'
const INVENTORY_ASSET_FIELDS = 'id,url,scan,size_bytes,mime_type,content_type,is_pdf,asset_category,pdf_accessibility_score,found_on_page_count'

export interface OrgInventoryPageRow extends InventoryPageRow {
  siteId: string
  siteName: string
  size_bytes?: number | null
}

export interface OrgInventoryAssetRow extends Record<string, unknown> {
  siteId: string
  siteName: string
}

export type OrgInventoryTab = 'pages' | 'files' | 'images' | 'pdfs'

type InventoryAssetRecord = {
  scan: string
  url: string
  size_bytes?: number
  mime_type?: string
  content_type?: string
  is_pdf?: boolean
  asset_category?: string
}

function siteNameLookup(sites: Awaited<ReturnType<typeof resolveOrgSites>>) {
  return new Map(sites.map(site => [site.siteId, site.name]))
}

function attachSiteFromPage<T extends { site?: string }>(
  items: T[],
  lookup: Map<string, string>
): Array<T & { siteId: string, siteName: string }> {
  return items.map((item) => {
    const siteId = item.site ?? ''
    return {
      ...item,
      siteId,
      siteName: lookup.get(siteId) ?? '—'
    }
  })
}

function attachSiteFromScan<T extends { scan: string }>(
  items: T[],
  sites: Awaited<ReturnType<typeof resolveOrgSites>>
): Array<T & { siteId: string, siteName: string }> {
  const byScan = new Map(
    sites.filter(site => site.latestScanId).map(site => [site.latestScanId!, site])
  )
  return items.map((item) => {
    const site = byScan.get(item.scan)
    return {
      ...item,
      siteId: site?.siteId ?? '',
      siteName: site?.name ?? '—'
    }
  })
}

function withPageSize(row: OrgInventoryPageRow): OrgInventoryPageRow {
  const bytes = inventoryRowSizeBytes(row as Record<string, unknown>)
  return {
    ...row,
    url: normalizeInventoryUrl(row.url),
    size_bytes: bytes > 0 ? bytes : null,
    inventoryBadge: null
  }
}

function withAssetSize(row: OrgInventoryAssetRow): OrgInventoryAssetRow {
  const bytes = inventoryRowSizeBytes(row as Record<string, unknown>)
  return {
    ...row,
    url: normalizeInventoryUrl(String(row.url ?? '')),
    size_bytes: bytes > 0 ? bytes : null
  }
}

function isImageAsset(item: InventoryAssetRecord): boolean {
  if (item.asset_category === 'image') return true
  if (item.asset_category === 'file' || item.asset_category === 'pdf') return false
  if (item.is_pdf || isInventoryPdfUrl(item.url)) return false
  if (String(item.mime_type || '').startsWith('image/')) return true
  return isInventoryImageUrl(item.url)
}

function isFileAsset(item: InventoryAssetRecord): boolean {
  if (item.asset_category === 'file') return true
  if (item.asset_category === 'image' || item.asset_category === 'pdf') return false
  return !isPdfAsset(item) && !isImageAsset(item)
}

function isPdfAsset(item: InventoryAssetRecord): boolean {
  if (item.asset_category === 'pdf') return true
  return Boolean(item.is_pdf) || isInventoryPdfUrl(item.url)
}

function filterAssetsForTab(items: InventoryAssetRecord[], tab: OrgInventoryTab): InventoryAssetRecord[] {
  if (tab === 'images') return items.filter(isImageAsset)
  if (tab === 'files') return items.filter(isFileAsset)
  if (tab === 'pdfs') return items.filter(isPdfAsset)
  return items
}

async function querySingleSiteAssetsPaginated(
  pb: PocketBase,
  sites: Awaited<ReturnType<typeof resolveOrgSites>>,
  tab: OrgInventoryTab,
  options: { page: number, perPage: number, search?: string }
) {
  const scanId = sites[0]!.latestScanId!
  const tabFilter = buildInventoryAssetTabFilter(tab)
  const filter = buildScanScopedSearchFilter(scanId, options.search, tabFilter ? [tabFilter] : [])

  const result = await pb.collection('qa_inventory').getList(options.page, options.perPage, {
    filter,
    fields: INVENTORY_ASSET_FIELDS,
    sort: 'url'
  })

  const items = filterAssetsForTab(result.items as InventoryAssetRecord[], tab)
    .map(row => withAssetSize(attachSiteFromScan([row], sites)[0]! as OrgInventoryAssetRow))

  return {
    items,
    total: result.totalItems,
    page: options.page,
    perPage: options.perPage
  }
}

async function querySingleSitePagesPaginated(
  pb: PocketBase,
  sites: Awaited<ReturnType<typeof resolveOrgSites>>,
  siteLookup: Map<string, string>,
  options: { page: number, perPage: number, search?: string }
) {
  const scanId = sites[0]!.latestScanId!
  const filter = buildScanScopedSearchFilter(scanId, options.search)
  const result = await pb.collection('pages').getList(options.page, options.perPage, {
    filter,
    fields: INVENTORY_PAGE_FIELDS,
    sort: 'url'
  })

  return {
    items: (result.items as Array<InventoryPageRow & { site?: string }>)
      .map(row => withPageSize(attachSiteFromPage([row], siteLookup)[0]! as OrgInventoryPageRow)),
    total: result.totalItems,
    page: options.page,
    perPage: options.perPage
  }
}

export async function queryOrgInventory(
  pb: PocketBase,
  orgId: string,
  options: {
    siteId?: string
    page: number
    perPage: number
    search?: string
    tab?: OrgInventoryTab
  }
) {
  const tab = options.tab ?? 'pages'
  const sites = await resolveOrgSites(pb, orgId, { siteId: options.siteId })
  if (!buildLatestScansFilter(sites)) {
    return emptyOrgList<OrgInventoryPageRow | OrgInventoryAssetRow>(options.page, options.perPage)
  }

  const siteLookup = siteNameLookup(sites)
  const singleSite = sites.length === 1 && sites[0]?.latestScanId

  if (singleSite && tab === 'pages') {
    return querySingleSitePagesPaginated(pb, sites, siteLookup, options)
  }

  if (singleSite && tab !== 'pages') {
    return querySingleSiteAssetsPaginated(pb, sites, tab, options)
  }

  const cacheKey = inventoryListCacheKey(orgId, {
    siteId: options.siteId,
    tab,
    search: options.search
  })
  const cached = getCachedInventoryList<OrgInventoryPageRow | OrgInventoryAssetRow>(cacheKey)
  if (cached) {
    return paginateMerged(cached, options.page, options.perPage)
  }

  if (tab === 'pages') {
    const raw = await fetchPbFullListPerSiteScan<InventoryPageRow & { site?: string }>(
      pb,
      'pages',
      sites,
      scanId => buildScanScopedSearchFilter(scanId, options.search),
      { fields: INVENTORY_PAGE_FIELDS, sort: 'url' }
    )
    const deduped = dedupeInventoryRowsByUrl(
      attachSiteFromPage(raw, siteLookup).map(withPageSize)
    )
    setCachedInventoryList(cacheKey, deduped)
    return paginateMerged(deduped, options.page, options.perPage)
  }

  const tabFilter = buildInventoryAssetTabFilter(tab)
  const raw = await fetchPbFullListPerSiteScan<InventoryAssetRecord>(
    pb,
    'qa_inventory',
    sites,
    scanId => buildScanScopedSearchFilter(scanId, options.search, tabFilter ? [tabFilter] : []),
    { fields: INVENTORY_ASSET_FIELDS, sort: 'url' }
  )

  const deduped = dedupeInventoryRowsByUrl(
    filterAssetsForTab(raw, tab)
      .map(row => attachSiteFromScan([row], sites)[0]!)
      .map(row => withAssetSize(row as OrgInventoryAssetRow))
  )
  setCachedInventoryList(cacheKey, deduped)
  return paginateMerged(deduped, options.page, options.perPage)
}
