import { ruleMeta } from './seoRuleCatalog.js'
import { isCanonicalSeoPageUrl } from './seoPageEligibility.js'
import type { SeoIssueDraft, SeoSettings, SeoSnapshot } from './types.js'

export interface PageSeoContext {
  url: string
  title: string
  wordCount: number
  readabilityScore: number
  snapshot: SeoSnapshot
  htmlSnapshot: string
  origin: string
  isHttps: boolean
  axeRuleIds: Set<string>
  isHomepage: boolean
  crawlDepth: number
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

function hasHeadingSkip(snapshot: SeoSnapshot): boolean {
  let prev = 1
  for (const level of snapshot.headings) {
    if (level > prev + 1) return true
    prev = level
  }
  return false
}

function hasFaqLikeContent(html: string): boolean {
  const faqHeadings = (html.match(/<h[1-6][^>]*>[^<]*faq[^<]*<\/h[1-6]>/gi) ?? []).length
  const detailsBlocks = (html.match(/<details\b/gi) ?? []).length
  return faqHeadings >= 2 || detailsBlocks >= 2
}

function hasOrganizationSchema(types: string[]): boolean {
  const lower = types.map(t => t.toLowerCase())
  return lower.some(t => t === 'organization' || t === 'localbusiness')
}

function isIndexable(snapshot: SeoSnapshot): boolean {
  const robots = (snapshot.robotsMeta || '').toLowerCase()
  return !robots.includes('noindex')
}

/** Per-page SEO rules (run during crawl). */
export function evaluateSeoRules(
  ctx: PageSeoContext,
  settings: SeoSettings
): SeoIssueDraft[] {
  if (!settings.checkSeo) return []

  const { snapshot, url, title } = ctx
  if (!isCanonicalSeoPageUrl(url)) return []

  const issues: SeoIssueDraft[] = []

  if (isIndexable(snapshot)) {
    if (!snapshot.canonical) {
      pushIssue(issues, 'missing-canonical', url)
    } else {
      try {
        const canonicalOrigin = new URL(snapshot.canonical).origin
        if (canonicalOrigin !== ctx.origin) {
          pushIssue(issues, 'canonical-off-domain', url, {
            current_value: snapshot.canonical,
            expected_value: ctx.origin
          })
        }
      } catch {
        pushIssue(issues, 'canonical-off-domain', url, { current_value: snapshot.canonical })
      }
    }
  }

  if (snapshot.robotsMeta?.toLowerCase().includes('noindex') && ctx.crawlDepth > 0) {
    pushIssue(issues, 'robots-noindex', url, { current_value: snapshot.robotsMeta })
  }

  if (!snapshot.htmlLang) {
    pushIssue(issues, 'missing-html-lang', url)
  }

  if (!snapshot.og?.title) pushIssue(issues, 'missing-og-title', url)
  if (!snapshot.og?.description) pushIssue(issues, 'missing-og-description', url)
  if (!snapshot.og?.image) pushIssue(issues, 'missing-og-image', url)

  if (settings.checkStructuredData) {
    for (const err of snapshot.jsonLdErrors) {
      pushIssue(issues, 'invalid-json-ld', url, {
        current_value: err.slice(0, 200),
        evidence: { error: err }
      })
    }
    if (ctx.isHomepage && snapshot.jsonLdTypes.length === 0 && snapshot.jsonLdErrors.length === 0) {
      pushIssue(issues, 'missing-json-ld', url)
    }
    if (ctx.isHomepage && snapshot.jsonLdTypes.length > 0 && !hasOrganizationSchema(snapshot.jsonLdTypes)) {
      pushIssue(issues, 'missing-organization-schema', url, {
        evidence: { types: snapshot.jsonLdTypes }
      })
    }
    if (hasFaqLikeContent(ctx.htmlSnapshot) && !snapshot.jsonLdTypes.some(t => t.toLowerCase() === 'faqpage')) {
      pushIssue(issues, 'missing-faq-schema', url)
    }
  }

  const titleLen = title.trim().length
  if (!titleLen) {
    pushIssue(issues, 'missing-title', url)
  } else {
    if (titleLen < settings.seoTitleMinLength) {
      pushIssue(issues, 'title-too-short', url, {
        current_value: String(titleLen),
        expected_value: `${settings.seoTitleMinLength}–${settings.seoTitleMaxLength} characters`
      })
    }
    if (titleLen > settings.seoTitleMaxLength) {
      pushIssue(issues, 'title-too-long', url, {
        current_value: String(titleLen),
        expected_value: `${settings.seoTitleMinLength}–${settings.seoTitleMaxLength} characters`
      })
    }
  }

  const desc = snapshot.metaDescription?.trim() || ''
  if (!desc) {
    pushIssue(issues, 'missing-meta-description', url)
  } else {
    if (desc.length < settings.seoDescMinLength) {
      pushIssue(issues, 'description-too-short', url, {
        current_value: String(desc.length),
        expected_value: `${settings.seoDescMinLength}–${settings.seoDescMaxLength} characters`
      })
    }
    if (desc.length > settings.seoDescMaxLength) {
      pushIssue(issues, 'description-too-long', url, {
        current_value: String(desc.length),
        expected_value: `${settings.seoDescMinLength}–${settings.seoDescMaxLength} characters`
      })
    }
  }

  const h1Count = snapshot.h1Count ?? (snapshot.h1 ? 1 : 0)
  if (h1Count === 0) pushIssue(issues, 'missing-h1', url)
  if (h1Count > 1) {
    pushIssue(issues, 'multiple-h1', url, { current_value: String(h1Count) })
  }
  if (hasHeadingSkip(snapshot)) {
    pushIssue(issues, 'heading-skip-level', url, {
      evidence: { headings: snapshot.headings }
    })
  }

  if (ctx.wordCount < settings.thinContentWordThreshold) {
    pushIssue(issues, 'thin-content', url, {
      current_value: String(ctx.wordCount),
      expected_value: `≥ ${settings.thinContentWordThreshold} words`
    })
  }

  if (ctx.readabilityScore > 0 && ctx.readabilityScore < settings.lowReadabilityThreshold) {
    pushIssue(issues, 'low-readability', url, {
      current_value: String(Math.round(ctx.readabilityScore)),
      expected_value: `≥ ${settings.lowReadabilityThreshold}`
    })
  }

  return issues
}
