import type PocketBase from 'pocketbase'
import { batchCreate, getPocketBase, withPocketBaseRetry } from './pocketbaseClient.js'
import { diffScans, type IssueFingerprint } from '../accessibility/diffEngine.js'
import type { PageResult } from '../crawler/siteCrawler.js'
import {
  aggregateScoresForScan,
  logScoreFieldsBeforePbWrite,
  scanScoreFieldsFromAggregate,
  type ScanScoreFields
} from '../crawler/siteCrawler.js'
import type { ElementTotals } from '../accessibility/siteimproveScore.js'
import { parseSiteSettings, type SiteSettings } from '../config/siteSettings.js'
import { DEFAULT_SEO_SETTINGS, type SeoIssueDraft, type SeoSettings } from '../seo/types.js'
import { runSeoSitePass } from '../seo/runSeoSitePass.js'
import { runCrawlabilityAudit } from '../seo/crawlabilityAudit.js'
import { calculateSeoScores } from '../seo/seoScore.js'
import type { SeoCrawlAudit } from '../seo/types.js'
import { normalizeSeoUrl } from '../seo/linkGraph.js'
import { reconcileSiteWebpageSearchIndex } from '../search/searchIndexer.js'
import { buildA11ySummary, issuesFromPageResults } from '../accessibility/buildA11ySummary.js'
import { reconcileSiteCurrentA11y } from '../accessibility/reconcileSiteCurrentA11y.js'

export interface FinalizeScanOptions {
  scanId: string
  siteId: string
  startUrl: string
  pages: PageResult[]
  inboundLinks: Map<string, Set<string>>
  sitemapUrls?: Set<string>
  siteSettings: SiteSettings
  diffFromPrevious?: boolean
  /** Run duplicate/orphan/sitemap site-level SEO checks (skip during background_scan handoff). */
  runSitePass?: boolean
  configSitemapUrl?: string
  /** When false, skip overwriting sites.current_a11y (untrusted / incomplete crawls). */
  updateCurrentA11y?: boolean
}

export function seoSettingsFromSite(siteSettings: SiteSettings): SeoSettings {
  const raw = siteSettings as SiteSettings & Partial<SeoSettings>
  return {
    checkSeo: raw.checkSeo ?? DEFAULT_SEO_SETTINGS.checkSeo,
    checkStructuredData: raw.checkStructuredData ?? DEFAULT_SEO_SETTINGS.checkStructuredData,
    seoTitleMinLength: raw.seoTitleMinLength ?? DEFAULT_SEO_SETTINGS.seoTitleMinLength,
    seoTitleMaxLength: raw.seoTitleMaxLength ?? DEFAULT_SEO_SETTINGS.seoTitleMaxLength,
    seoDescMinLength: raw.seoDescMinLength ?? DEFAULT_SEO_SETTINGS.seoDescMinLength,
    seoDescMaxLength: raw.seoDescMaxLength ?? DEFAULT_SEO_SETTINGS.seoDescMaxLength,
    thinContentWordThreshold: raw.thinContentWordThreshold ?? DEFAULT_SEO_SETTINGS.thinContentWordThreshold,
    lowReadabilityThreshold: raw.lowReadabilityThreshold ?? DEFAULT_SEO_SETTINGS.lowReadabilityThreshold
  }
}

/**
 * @deprecated Accessibility overview uses score_overall as a11y-only.
 * QA and SEO stay on score_qa / score_seo.
 */
export function blendOverallScore(
  accessibility: number,
  _qa: number,
  _seo: number | undefined,
  _checkSeo: boolean
): number {
  return accessibility
}

export interface FinalizeScanResult {
  scoreFields: ScanScoreFields & {
    score_seo?: number
    score_seo_technical?: number
    score_seo_content?: number
    score_seo_crawlability?: number
    seo_crawl_audit?: SeoCrawlAudit
  }
  diffSummary: ReturnType<typeof diffScans> | null
  openIssueCount: number
  brokenLinkCount: number
  seoIssueCount: number
  a11ySummary: ReturnType<typeof buildA11ySummary>
}

async function loadUrlToPageId(pb: PocketBase, scanId: string): Promise<Map<string, string>> {
  const records = await pb.collection('pages').getFullList({
    filter: `scan = "${scanId}"`,
    fields: 'id,url'
  })
  const map = new Map<string, string>()
  for (const record of records) {
    const url = String((record as { url?: string }).url ?? '')
    const id = String((record as { id: string }).id)
    map.set(normalizeSeoUrl(url), id)
  }
  return map
}

function openIssueCountFromPages(pages: PageResult[]): number {
  return pages.reduce(
    (count, page) => count + page.issues.filter(issue => (issue.status || 'open') === 'open').length,
    0
  )
}

function currentIssueFingerprints(pages: PageResult[]): IssueFingerprint[] {
  return pages.flatMap(page => page.issues.map(issue => ({
    rule_id: issue.rule_id,
    css_selector: issue.css_selector,
    page_url: page.url
  })))
}

async function loadScanIssueFingerprints(
  pb: PocketBase,
  scanId: string
): Promise<Array<IssueFingerprint & { id: string }>> {
  const pages = await pb.collection('pages').getFullList({
    filter: `scan = "${scanId}"`,
    fields: 'id,url'
  }) as Array<{ id: string, url?: string }>
  const urlById = new Map(pages.map(page => [page.id, String(page.url ?? '')]))
  const issues = await pb.collection('accessibility_issues').getFullList({
    filter: `scan = "${scanId}"`,
    fields: 'id,rule_id,css_selector,page'
  }) as Array<{ id: string, rule_id?: string, css_selector?: string, page?: string }>
  return issues.map(issue => ({
    id: issue.id,
    rule_id: String(issue.rule_id ?? ''),
    css_selector: String(issue.css_selector ?? ''),
    page_url: urlById.get(String(issue.page ?? '')) || ''
  }))
}

async function persistSiteSeoIssues(
  pb: PocketBase,
  scanId: string,
  siteId: string,
  siteIssues: SeoIssueDraft[]
): Promise<void> {
  if (!siteIssues.length) return
  const existing = await withPocketBaseRetry(
    () => pb.collection('seo_issues').getList(1, 1, {
      filter: `scan = "${scanId}"`,
      fields: 'id'
    }),
    { label: 'existing seo issues', resetClient: false }
  )
  if (existing.totalItems > 0) return

  const urlToPageId = await withPocketBaseRetry(
    () => loadUrlToPageId(pb, scanId),
    { label: 'page id map', resetClient: false }
  )
  const siteRecords = siteIssues
    .map(d => draftToRecord(d, scanId, siteId, urlToPageId))
    .filter(r => !r.page || typeof r.page === 'string')
  if (siteRecords.length) {
    await withPocketBaseRetry(
      () => batchCreate('seo_issues', siteRecords),
      { label: 'seo issue create', resetClient: false }
    )
  }
}

function draftToRecord(
  draft: SeoIssueDraft,
  scanId: string,
  siteId: string,
  urlToPageId: Map<string, string>
): Record<string, unknown> {
  const pageId = draft.pageUrl ? urlToPageId.get(normalizeSeoUrl(draft.pageUrl)) : undefined
  return {
    scan: scanId,
    site: siteId,
    ...(pageId ? { page: pageId } : {}),
    rule_id: draft.rule_id,
    category: draft.category,
    subcategory: draft.subcategory,
    severity: draft.severity,
    status: 'open',
    title: draft.title,
    description: draft.description,
    recommendation: draft.recommendation,
    current_value: draft.current_value ?? '',
    expected_value: draft.expected_value ?? '',
    evidence: draft.evidence ?? null
  }
}

export async function finalizeScan(
  pb: PocketBase,
  options: FinalizeScanOptions
): Promise<FinalizeScanResult> {
  const seoSettings = seoSettingsFromSite(options.siteSettings)
  const origin = new URL(options.startUrl).origin
  const runSitePass = options.runSitePass !== false

  let siteIssues: SeoIssueDraft[] = []
  let crawlAudit: SeoCrawlAudit | undefined

  if (seoSettings.checkSeo) {
    const crawlResult = await runCrawlabilityAudit({
      origin,
      startUrl: options.startUrl,
      configSitemapUrl: options.configSitemapUrl,
      crawledPages: options.pages.map(p => ({
        url: p.url,
        seoSnapshot: p.seoSnapshot
      }))
    })
    siteIssues.push(...crawlResult.issues)
    crawlAudit = crawlResult.audit
  }

  if (runSitePass) {
    const passIssues = runSeoSitePass(
      options.pages.map(p => ({
        url: p.url,
        title: p.title,
        metaDescription: p.seoSnapshot?.metaDescription,
        htmlSnapshot: p.htmlSnapshot,
        crawlDepth: p.crawlDepth
      })),
      {
        startUrl: options.startUrl,
        origin,
        isHttps: options.startUrl.startsWith('https://'),
        inboundLinks: options.inboundLinks,
        sitemapUrls: options.sitemapUrls,
        settings: seoSettings
      }
    )
    siteIssues.push(...passIssues)

    await persistSiteSeoIssues(pb, options.scanId, options.siteId, siteIssues)
  } else if (siteIssues.length) {
    await persistSiteSeoIssues(pb, options.scanId, options.siteId, siteIssues)
  }

  const allSeoIssues: SeoIssueDraft[] = [
    ...options.pages.flatMap(p => p.seoIssues ?? []),
    ...siteIssues
  ]

  const seoScores = calculateSeoScores(allSeoIssues, options.pages.length)
  const aggregated = aggregateScoresForScan(options.scanId, options.pages, {
    depthWeightedScoring: options.siteSettings.depthWeightedScoring
  })
  const baseFields = scanScoreFieldsFromAggregate(aggregated)
  const scoreFields = {
    ...baseFields,
    ...seoScores,
    ...(crawlAudit ? { seo_crawl_audit: crawlAudit } : {})
  }
  logScoreFieldsBeforePbWrite(options.scanId, scoreFields)
  console.log(`Finalize: scores ready for scan ${options.scanId}`)

  const a11ySummary = buildA11ySummary(
    issuesFromPageResults(
      options.pages.map(page => ({
        url: page.url,
        issues: page.issues.map(issue => ({
          rule_id: issue.rule_id,
          wcag_level: issue.wcag_level,
          impact: issue.impact,
          element_type: issue.element_type,
          status: issue.status ?? 'open'
        }))
      }))
    ),
    {
      pageCount: options.pages.length,
      elementTotals: baseFields.score_denominators?.elements,
      checkStats: baseFields.a11y_check_stats
    }
  )

  let diffSummary: ReturnType<typeof diffScans> | null = null
  if (options.diffFromPrevious) {
    const previousScans = await withPocketBaseRetry(
      () => pb.collection('scans').getList(1, 1, {
        filter: `site = "${options.siteId}" && (status = 'complete' || status = 'complete_with_errors') && id != "${options.scanId}"`,
        sort: '-completed_at'
      }),
      { label: 'previous scan lookup', resetClient: false }
    )

    if (previousScans.items.length > 0) {
      const prevScanId = previousScans.items[0].id
      const previousIssues = await withPocketBaseRetry(
        () => loadScanIssueFingerprints(pb, prevScanId),
        { label: 'previous issue fingerprints', resetClient: false }
      )
      diffSummary = diffScans(currentIssueFingerprints(options.pages), previousIssues)
    }
  }

  const brokenLinks = await withPocketBaseRetry(
    () => pb.collection('qa_broken_links').getList(1, 1, {
      filter: `scan = "${options.scanId}" && status != "dismissed"`,
      fields: 'id'
    }),
    { label: 'broken link count', resetClient: false }
  )

  return {
    scoreFields,
    diffSummary,
    openIssueCount: openIssueCountFromPages(options.pages),
    brokenLinkCount: brokenLinks.totalItems,
    seoIssueCount: allSeoIssues.length,
    a11ySummary
  }
}

/** Run after the scan row is marked complete so a crash here cannot leave the scan running. */
export function schedulePostScanReconcile(
  siteId: string,
  options?: { elementTotals?: ElementTotals, updateCurrentA11y?: boolean }
): void {
  void reconcileSiteWebpageSearchIndex(siteId).catch(err => {
    console.warn(`Search reconcile failed for site ${siteId}:`, err instanceof Error ? err.message : err)
  })
  if (options?.updateCurrentA11y === false) return
  void reconcileSiteCurrentA11y(getPocketBase(), siteId, options?.elementTotals).catch(err => {
    console.warn(`A11y summary reconcile failed for site ${siteId}:`, err instanceof Error ? err.message : err)
  })
}

export { parseSiteSettings }
