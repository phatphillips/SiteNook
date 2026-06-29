import { getPocketBase, batchCreate } from './pocketbaseClient.js'
import { requireHttpUrl, sanitizeAxeIssue, sanitizeInventoryRecord } from './recordSanitize.js'
import { runPolicies, type Policy } from '../qa/policyEngine.js'
import type { ParsedScanConfig } from '../config/scanConfig.js'
import type { PageResult } from '../crawler/siteCrawler.js'
import type { SeoIssueDraft } from '../seo/types.js'
import { normalizeSeoUrl } from '../seo/linkGraph.js'
import { indexWebpageFromPage } from '../search/searchIndexer.js'
import { extractHrefUrlsFromHtml, mergeOutboundLinkUrls } from '../search/outboundLinks.js'

export interface SavePageResultOptions {
  persistInventory?: boolean
}

export async function loadPolicies(siteId: string): Promise<Policy[]> {
  const pb = getPocketBase()

  try {
    const records = await pb.collection('policies').getFullList()
    return records.filter((record) => {
      const policySite = (record as { site?: string }).site
      return !policySite || policySite === siteId
    }) as unknown as Policy[]
  } catch (err) {
    console.warn('Could not load policies, continuing without policy checks:', err)
    return []
  }
}

function seoIssueToRecord(
  draft: SeoIssueDraft,
  scanId: string,
  siteId: string,
  pageId: string
): Record<string, unknown> {
  return {
    scan: scanId,
    site: siteId,
    page: pageId,
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

export async function saveSinglePageResult(
  pageResult: PageResult,
  scanId: string,
  siteId: string,
  startUrl: string,
  _config: ParsedScanConfig,
  policies: Policy[],
  options?: SavePageResultOptions
) {
  const pb = getPocketBase()
  const pageUrl = requireHttpUrl(pageResult.url, startUrl)

  const pageRecord = await pb.collection('pages').create({
    scan: scanId,
    site: siteId,
    url: pageUrl,
    title: pageResult.title,
    status_code: pageResult.statusCode,
    word_count: pageResult.wordCount,
    readability_score: pageResult.readabilityScore,
    readability_scores: pageResult.readabilityScores,
    crawl_depth: pageResult.crawlDepth,
    html_snapshot: pageResult.htmlSnapshot.slice(0, 200000),
    ...(pageResult.seoSnapshot ? { seo_snapshot: pageResult.seoSnapshot } : {})
  })

  if (pageResult.issues.length) {
    await batchCreate('accessibility_issues', pageResult.issues.map(issue =>
      sanitizeAxeIssue({
        ...issue,
        scan: scanId,
        page: pageRecord.id
      })
    ))
  }

  const links = pageResult.brokenLinks
    .filter(link => {
      try {
        requireHttpUrl(link.href)
        return true
      } catch {
        return false
      }
    })
    .map(link => ({
      ...link,
      href: requireHttpUrl(link.href),
      scan: scanId,
      page: pageRecord.id
    }))
  if (links.length) await batchCreate('qa_broken_links', links)

  if (pageResult.spelling.length) {
    await batchCreate('qa_spelling', pageResult.spelling.map(s => ({
      ...s,
      scan: scanId,
      page: pageRecord.id
    })))
  }

  const inventory = pageResult.inventory
    .map(item => sanitizeInventoryRecord({ ...item, scan: scanId }))
    .filter((item): item is NonNullable<typeof item> => item !== null)
  if (options?.persistInventory && inventory.length) {
    await batchCreate('qa_inventory', inventory)
  }

  if (pageResult.seoIssues?.length) {
    await batchCreate('seo_issues', pageResult.seoIssues.map(draft =>
      seoIssueToRecord(draft, scanId, siteId, pageRecord.id)
    ))
  }

  if (policies.length) {
    const policyMatches = runPolicies(pageResult.htmlSnapshot, policies).map(m => ({
      ...m,
      scan: scanId,
      page: pageRecord.id
    }))
    if (policyMatches.length) await batchCreate('policy_matches', policyMatches)
  }

  void indexWebpageFromPage(pb, {
    pageId: pageRecord.id,
    siteId,
    url: pageUrl,
    title: pageResult.title,
    htmlSnapshot: pageResult.htmlSnapshot,
    outboundLinkUrls: mergeOutboundLinkUrls(
      pageResult.linkHrefs,
      pageResult.brokenLinks.map(link => link.href),
      extractHrefUrlsFromHtml(pageResult.htmlSnapshot, pageUrl)
    )
  }).catch(err => {
    console.warn(`Search index failed for page ${pageRecord.id}:`, err instanceof Error ? err.message : err)
  })
}

export { normalizeSeoUrl }
