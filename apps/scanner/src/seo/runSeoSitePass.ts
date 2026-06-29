import { ruleMeta } from './seoRuleCatalog.js'
import { normalizeSeoUrl } from './linkGraph.js'
import { isCanonicalSeoPageUrl } from './seoPageEligibility.js'
import type { SeoIssueDraft, SeoSettings } from './types.js'

export interface SiteSeoPageInput {
  url: string
  title: string
  metaDescription?: string
  htmlSnapshot: string
  crawlDepth: number
}

export interface SiteSeoPassContext {
  startUrl: string
  origin: string
  isHttps: boolean
  inboundLinks: Map<string, Set<string>>
  sitemapUrls?: Set<string>
  settings: SeoSettings
}

function pushIssue(
  issues: SeoIssueDraft[],
  ruleId: string,
  pageUrl: string,
  extra?: Partial<SeoIssueDraft>
): void {
  const meta = ruleMeta(ruleId)
  issues.push({
    rule_id: ruleId,
    category: meta.category,
    subcategory: meta.subcategory,
    severity: meta.severity,
    title: meta.title,
    description: meta.title,
    recommendation: meta.recommendation,
    pageUrl,
    ...extra
  })
}

function groupByNormalizedValue(
  pages: SiteSeoPageInput[],
  valueFn: (p: SiteSeoPageInput) => string | undefined
): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const page of pages) {
    const raw = valueFn(page)?.trim()
    if (!raw) continue
    const key = raw.toLowerCase()
    const urls = groups.get(key) ?? []
    urls.push(page.url)
    groups.set(key, urls)
  }
  return groups
}

/** Site-level SEO rules (run at scan finalize). */
export function runSeoSitePass(
  pages: SiteSeoPageInput[],
  ctx: SiteSeoPassContext
): SeoIssueDraft[] {
  if (!ctx.settings.checkSeo || pages.length === 0) return []

  const issues: SeoIssueDraft[] = []
  const startNormalized = normalizeSeoUrl(ctx.startUrl)
  const canonicalPages = pages.filter(p => isCanonicalSeoPageUrl(p.url))

  const titleGroups = groupByNormalizedValue(canonicalPages, p => p.title)
  for (const [, urls] of titleGroups) {
    if (urls.length < 2) continue
    for (const url of urls) {
      pushIssue(issues, 'duplicate-title', url, {
        evidence: { duplicateUrls: urls.filter(u => u !== url) }
      })
    }
  }

  const descGroups = groupByNormalizedValue(canonicalPages, p => p.metaDescription)
  for (const [, urls] of descGroups) {
    if (urls.length < 2) continue
    for (const url of urls) {
      pushIssue(issues, 'duplicate-meta-description', url, {
        evidence: { duplicateUrls: urls.filter(u => u !== url) }
      })
    }
  }

  for (const page of canonicalPages) {
    const normalized = normalizeSeoUrl(page.url)
    if (normalized === startNormalized) continue
    const inbound = ctx.inboundLinks.get(normalized)
    if (!inbound || inbound.size === 0) {
      pushIssue(issues, 'orphan-page', page.url)
    }

    if (ctx.isHttps && page.htmlSnapshot.includes('href="http://')) {
      const httpInternal = /href=["']http:\/\/[^"']*["']/i.test(page.htmlSnapshot)
      if (httpInternal) {
        try {
          const hasInternalHttp = [...page.htmlSnapshot.matchAll(/href=["'](http:\/\/[^"']+)["']/gi)]
            .some(m => {
              try {
                return new URL(m[1]).origin === ctx.origin
              } catch {
                return false
              }
            })
          if (hasInternalHttp) {
            pushIssue(issues, 'http-internal-link', page.url)
          }
        } catch {
          // skip
        }
      }
    }

    if (ctx.sitemapUrls && ctx.sitemapUrls.size > 0) {
      if (!ctx.sitemapUrls.has(normalized)) {
        pushIssue(issues, 'page-not-in-sitemap', page.url)
      }
    }
  }

  return issues
}
