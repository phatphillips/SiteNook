import { batchCreate, getPocketBase } from './pocketbaseClient.js'
import { requireHttpUrl, sanitizeAxeIssue, sanitizeInventoryRecord } from './recordSanitize.js'
import type { Policy } from '../qa/policyEngine.js'
import { runPolicies } from '../qa/policyEngine.js'
import type { ParsedScanConfig } from '../config/scanConfig.js'
import type { PageResult } from '../crawler/siteCrawler.js'
import type { SeoIssueDraft } from '../seo/types.js'
import {
  saveSinglePageResult,
  type SavePageResultOptions
} from './savePageResult.js'
import { indexWebpageFromPage } from '../search/searchIndexer.js'
import { extractHrefUrlsFromHtml, mergeOutboundLinkUrls } from '../search/outboundLinks.js'
import { buildInventoryRefsForPage } from '../qa/inventoryRefs.js'
import { truncateHtmlSnapshot } from '../utils/truncateHtmlSnapshot.js'
import { attachPageSimulatorPreview } from './attachPageSimulatorPreview.js'
import { attachPageRenderedHtml } from './attachPageRenderedHtml.js'
import { persistContentObservation } from '../content/persistContentObservation.js'
import { createPageRecord } from './createPageRecord.js'

type ChildCollection
  = | 'accessibility_issues'
    | 'qa_broken_links'
    | 'qa_spelling'
    | 'qa_inventory'
    | 'qa_inventory_refs'
    | 'seo_issues'
    | 'policy_matches'

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

export interface PageResultPersistence {
  save(pageResult: PageResult): Promise<void>
  flush(): Promise<void>
}

export interface PagePersistenceContext {
  scanId: string
  siteId: string
  startUrl: string
  config: ParsedScanConfig
  policies: Policy[]
  options?: SavePageResultOptions
}

class BufferedPageResultPersistence implements PageResultPersistence {
  private pagesSinceFlush = 0
  private readonly buffers = new Map<ChildCollection, Record<string, unknown>[]>()

  constructor(
    private readonly flushEveryPages: number,
    private readonly ctx: PagePersistenceContext
  ) {}

  async save(pageResult: PageResult): Promise<void> {
    const pb = getPocketBase()
    const pageUrl = requireHttpUrl(pageResult.url, this.ctx.startUrl)

    const pageRecord = await createPageRecord(pb, {
      scan: this.ctx.scanId,
      site: this.ctx.siteId,
      url: pageUrl,
      title: pageResult.title,
      status_code: pageResult.statusCode,
      word_count: pageResult.wordCount,
      readability_score: pageResult.readabilityScore,
      readability_scores: pageResult.readabilityScores,
      crawl_depth: pageResult.crawlDepth,
      html_snapshot: truncateHtmlSnapshot(pageResult.htmlSnapshot),
      html_size_bytes: pageResult.htmlSizeBytes,
      ...(pageResult.tabOrder ? { tab_order: pageResult.tabOrder } : {}),
      ...(pageResult.seoSnapshot ? { seo_snapshot: pageResult.seoSnapshot } : {})
    })

    await attachPageSimulatorPreview(pb, pageRecord.id, pageResult.previewImage)
    await attachPageRenderedHtml(pb, pageRecord.id, pageResult.renderedHtml)

    if (pageResult.contentMarkdown?.trim()) {
      try {
        const content = await persistContentObservation(pb, {
          scanId: this.ctx.scanId,
          siteId: this.ctx.siteId,
          pageId: pageRecord.id,
          pageUrl,
          title: pageResult.title,
          markdown: pageResult.contentMarkdown
        })
        if (content) {
          await pb.collection('pages').update(pageRecord.id, {
            content_blob: content.blobId,
            content_hash: content.contentHash,
            content_unchanged: content.unchanged
          })
        }
      } catch (err) {
        console.warn(
          `Content observation failed for page ${pageRecord.id}:`,
          err instanceof Error ? err.message : err
        )
      }
    }

    this.pushChild('accessibility_issues', pageResult.issues.map(issue =>
      sanitizeAxeIssue({
        ...issue,
        scan: this.ctx.scanId,
        page: pageRecord.id
      })
    ))

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
        scan: this.ctx.scanId,
        page: pageRecord.id
      }))
    this.pushChild('qa_broken_links', links)

    this.pushChild('qa_spelling', pageResult.spelling.map(s => ({
      ...s,
      scan: this.ctx.scanId,
      page: pageRecord.id
    })))

    if (this.ctx.options?.persistInventory) {
      const inventory = pageResult.inventory
        .map(item => sanitizeInventoryRecord({ ...item, scan: this.ctx.scanId }))
        .filter((item): item is NonNullable<typeof item> => item !== null)
      this.pushChild('qa_inventory', inventory)
      this.pushChild(
        'qa_inventory_refs',
        buildInventoryRefsForPage(this.ctx.scanId, pageRecord.id, inventory)
      )
    }

    if (pageResult.seoIssues?.length) {
      this.pushChild('seo_issues', pageResult.seoIssues.map(draft =>
        seoIssueToRecord(draft, this.ctx.scanId, this.ctx.siteId, pageRecord.id)
      ))
    }

    if (this.ctx.policies.length) {
      const policyMatches = runPolicies(pageResult.htmlSnapshot, this.ctx.policies).map(m => ({
        ...m,
        scan: this.ctx.scanId,
        page: pageRecord.id
      }))
      this.pushChild('policy_matches', policyMatches)
    }

    this.pagesSinceFlush += 1

    void indexWebpageFromPage(pb, {
      pageId: pageRecord.id,
      siteId: this.ctx.siteId,
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

    if (this.pagesSinceFlush >= this.flushEveryPages) {
      await this.flush()
    }
  }

  private pushChild(collection: ChildCollection, records: Record<string, unknown>[]) {
    if (!records.length) return
    const existing = this.buffers.get(collection) ?? []
    existing.push(...records)
    this.buffers.set(collection, existing)
  }

  async flush(): Promise<void> {
    for (const [collection, records] of this.buffers.entries()) {
      if (!records.length) continue
      await batchCreate(collection, records.splice(0, records.length))
    }
    this.pagesSinceFlush = 0
  }
}

class DirectPageResultPersistence implements PageResultPersistence {
  constructor(private readonly ctx: PagePersistenceContext) {}

  async save(pageResult: PageResult): Promise<void> {
    await saveSinglePageResult(
      pageResult,
      this.ctx.scanId,
      this.ctx.siteId,
      this.ctx.startUrl,
      this.ctx.config,
      this.ctx.policies,
      this.ctx.options
    )
  }

  async flush(): Promise<void> {
    // no-op
  }
}

export function createPageResultPersistence(ctx: PagePersistenceContext): PageResultPersistence {
  const flushEveryPages = Number(process.env.SCANNER_FLUSH_EVERY_PAGES || 5)
  if (flushEveryPages <= 1) {
    return new DirectPageResultPersistence(ctx)
  }
  return new BufferedPageResultPersistence(flushEveryPages, ctx)
}
