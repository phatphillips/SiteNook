import type PocketBase from 'pocketbase'
import { batchCreate } from './pocketbaseClient.js'
import { diffScans } from '../accessibility/diffEngine.js'
import type { PageResult } from '../crawler/siteCrawler.js'
import {
  aggregateScoresForScan,
  logScoreFieldsBeforePbWrite,
  scanScoreFieldsFromAggregate,
  type ScanScoreFields
} from '../crawler/siteCrawler.js'
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

/** Blend accessibility, QA, and SEO into a single overall score when SEO is enabled. */
export function blendOverallScore(
  accessibility: number,
  qa: number,
  seo: number | undefined,
  checkSeo: boolean
): number {
  if (!checkSeo || seo == null) return accessibility
  const blended = (accessibility + qa + seo) / 3
  return Math.round(blended * 10) / 10
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

    const urlToPageId = await loadUrlToPageId(pb, options.scanId)
    const siteRecords = siteIssues
      .map(d => draftToRecord(d, options.scanId, options.siteId, urlToPageId))
      .filter(r => !r.page || typeof r.page === 'string')

    if (siteRecords.length) {
      await batchCreate('seo_issues', siteRecords)
    }
  } else if (siteIssues.length) {
    const urlToPageId = await loadUrlToPageId(pb, options.scanId)
    const siteRecords = siteIssues
      .map(d => draftToRecord(d, options.scanId, options.siteId, urlToPageId))
      .filter(r => !r.page || typeof r.page === 'string')
    if (siteRecords.length) {
      await batchCreate('seo_issues', siteRecords)
    }
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
    ...(crawlAudit ? { seo_crawl_audit: crawlAudit } : {}),
    score_overall: blendOverallScore(
      baseFields.score_overall,
      baseFields.score_qa,
      seoScores.score_seo,
      seoSettings.checkSeo
    )
  }
  logScoreFieldsBeforePbWrite(options.scanId, scoreFields)

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
      elementTotals: baseFields.score_denominators?.elements
    }
  )

  let diffSummary: ReturnType<typeof diffScans> | null = null
  if (options.diffFromPrevious) {
    const previousScans = await pb.collection('scans').getList(1, 1, {
      filter: `site = "${options.siteId}" && (status = 'complete' || status = 'complete_with_errors') && id != "${options.scanId}"`,
      sort: '-completed_at'
    })

    if (previousScans.items.length > 0) {
      const prevScanId = previousScans.items[0].id
      const [currentIssues, previousIssues] = await Promise.all([
        pb.collection('accessibility_issues').getFullList({ filter: `scan = "${options.scanId}"`, expand: 'page' }),
        pb.collection('accessibility_issues').getFullList({ filter: `scan = "${prevScanId}"`, expand: 'page' })
      ])

      diffSummary = diffScans(
        currentIssues.map(i => ({
          id: i.id,
          rule_id: String((i as { rule_id?: string }).rule_id ?? ''),
          css_selector: String((i as { css_selector?: string }).css_selector ?? ''),
          page_url: String((i.expand as { page?: { url: string } })?.page?.url ?? '')
        })),
        previousIssues.map(i => ({
          id: i.id,
          rule_id: String((i as { rule_id?: string }).rule_id ?? ''),
          css_selector: String((i as { css_selector?: string }).css_selector ?? ''),
          page_url: String((i.expand as { page?: { url: string } })?.page?.url ?? '')
        }))
      )
    }
  }

  const openIssues = await pb.collection('accessibility_issues').getFullList({
    filter: `scan = "${options.scanId}" && status = 'open'`,
    fields: 'id'
  })

  void reconcileSiteWebpageSearchIndex(options.siteId).catch(err => {
    console.warn(`Search reconcile failed for site ${options.siteId}:`, err instanceof Error ? err.message : err)
  })

  void reconcileSiteCurrentA11y(pb, options.siteId, baseFields.score_denominators?.elements).catch(err => {
    console.warn(`A11y summary reconcile failed for site ${options.siteId}:`, err instanceof Error ? err.message : err)
  })

  return {
    scoreFields,
    diffSummary,
    openIssueCount: openIssues.length,
    seoIssueCount: allSeoIssues.length,
    a11ySummary
  }
}

export { parseSiteSettings }
