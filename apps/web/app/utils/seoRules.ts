export const SEO_CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical SEO',
  content: 'Content SEO'
}

export const SEO_SUBCATEGORY_LABELS: Record<string, string> = {
  on_page: 'On-page',
  crawlability: 'Crawlability',
  structured_data: 'Structured data',
  content_quality: 'Content quality',
  duplicates: 'Duplicates'
}

export const SEO_RULE_LABELS: Record<string, string> = {
  'missing-canonical': 'Missing canonical URL',
  'canonical-off-domain': 'Canonical off-domain',
  'robots-noindex': 'Blocked from indexing',
  'missing-html-lang': 'Missing HTML language',
  'missing-og-title': 'Missing Open Graph title',
  'missing-og-description': 'Missing Open Graph description',
  'missing-og-image': 'Missing Open Graph image',
  'invalid-json-ld': 'Invalid JSON-LD',
  'missing-json-ld': 'No structured data',
  'http-internal-link': 'HTTP internal links',
  'orphan-page': 'Orphan page',
  'page-not-in-sitemap': 'Not in sitemap',
  'robots-unreachable': 'robots.txt unreachable',
  'robots-missing-sitemap-directive': 'No sitemap in robots.txt',
  'sitemap-unreachable': 'Sitemap unreachable',
  'sitemap-invalid-xml': 'Invalid sitemap XML',
  'sitemap-over-limit': 'Sitemap over size limit',
  'sitemap-relative-url': 'Relative URLs in sitemap',
  'sitemap-bad-urls': 'Bad URLs in sitemap',
  'sitemap-noindex-urls': 'Noindex URLs in sitemap',
  'sitemap-missing-lastmod': 'Missing lastmod in sitemap',
  'sitemap-stale-lastmod': 'Stale lastmod in sitemap',
  'sitemap-index-missing': 'Missing sitemap index',
  'llms-missing': 'llms.txt missing',
  'llms-invalid-format': 'Invalid llms.txt',
  'ai-bot-blocked': 'AI bot blocked',
  'missing-organization-schema': 'No Organization schema',
  'missing-faq-schema': 'Missing FAQ schema',
  'duplicate-title': 'Duplicate title',
  'duplicate-meta-description': 'Duplicate meta description',
  'missing-title': 'Missing title',
  'title-too-short': 'Title too short',
  'title-too-long': 'Title too long',
  'missing-meta-description': 'Missing meta description',
  'description-too-short': 'Description too short',
  'description-too-long': 'Description too long',
  'missing-h1': 'Missing H1',
  'multiple-h1': 'Multiple H1',
  'heading-skip-level': 'Skipped heading level',
  'thin-content': 'Thin content',
  'low-readability': 'Low readability'
}

/** Plain-English context for editors. Why the rule matters for search visibility. */
export const SEO_RULE_WHY: Record<string, string> = {
  'missing-title': 'Search engines use the title tag as the primary headline in results. Without it, your page is harder to rank and click.',
  'missing-meta-description': 'The meta description is often shown as the snippet below your title in search results. A missing or weak description reduces clicks.',
  'duplicate-title': 'Duplicate titles confuse search engines about which page to rank and can dilute visibility across your site.',
  'missing-h1': 'A clear H1 helps search engines understand the main topic and aligns with what users expect on the page.',
  'thin-content': 'Pages with very little text may be seen as low value and rank poorly compared to more substantive content.',
  'low-readability': 'Hard-to-read content can increase bounce rates, which indirectly hurts search performance.',
  'orphan-page': 'Pages with no internal links are harder for crawlers to discover and may not get indexed.',
  'missing-canonical': 'Without a canonical URL, search engines may index duplicate or parameterised versions of the same content.',
  'robots-unreachable': 'Crawlers expect a robots.txt file at your site root to learn crawl rules and find your sitemap.',
  'robots-missing-sitemap-directive': 'Declaring your sitemap in robots.txt helps search engines discover it reliably.',
  'sitemap-unreachable': 'An unreachable sitemap means search engines may miss pages you intended to submit for indexing.',
  'llms-missing': 'llms.txt gives AI crawlers a curated summary of your site. Increasingly expected for AI discoverability.',
  'ai-bot-blocked': 'Blocking AI search bots may reduce visibility in AI-powered search results.',
  'sitemap-bad-urls': 'Listing broken or redirecting URLs in your sitemap wastes crawl budget and signals poor site health.',
  'sitemap-noindex-urls': 'Submitting noindex pages in a sitemap sends conflicting signals to search engines.'
}

/** Example corrected markup shown in the issue drawer. */
export const SEO_RULE_FIX_EXAMPLES: Record<string, string> = {
  'missing-title': '<title>Descriptive page title. Brand Name</title>',
  'title-too-short': '<title>Expand this title to describe the page topic clearly</title>',
  'title-too-long': '<title>Keep titles under ~60 characters for mobile SERPs</title>',
  'missing-meta-description': '<meta name="description" content="A concise summary of this page for search results.">',
  'description-too-short': '<meta name="description" content="Expand to 70–160 characters with a compelling summary.">',
  'description-too-long': '<meta name="description" content="Shorten so the snippet is not truncated in search results.">',
  'missing-canonical': '<link rel="canonical" href="https://example.com/preferred-url">',
  'missing-html-lang': '<html lang="en">',
  'missing-h1': '<h1>Primary topic of this page</h1>',
  'multiple-h1': '<!-- Use one H1; demote extras to H2 -->',
  'missing-og-title': '<meta property="og:title" content="Title for social sharing">',
  'missing-og-description': '<meta property="og:description" content="Description for social sharing">',
  'missing-og-image': '<meta property="og:image" content="https://example.com/image.jpg">',
  'robots-missing-sitemap-directive': 'Sitemap: https://example.com/sitemap.xml',
  'llms-missing': '# Example Site\n\n> A brief description of your site and what it offers.\n\n## Key pages\n- [Home](https://example.com/)'
}

/** axe rules that overlap. Link from SEO drawer to accessibility issues. */
export const SEO_AXE_RULE_LINKS: Record<string, string> = {
  'missing-title': 'document-title',
  'missing-h1': 'page-has-heading-one',
  'multiple-h1': 'page-has-heading-one',
  'heading-skip-level': 'heading-order',
  'missing-html-lang': 'html-has-lang'
}

export function ruleLabel(ruleId: string): string {
  return SEO_RULE_LABELS[ruleId] ?? ruleId
}

export function ruleWhyItMatters(ruleId: string): string {
  return SEO_RULE_WHY[ruleId] ?? 'This issue can reduce search visibility or click-through rates from organic results.'
}

export function ruleFixExample(ruleId: string): string | null {
  return SEO_RULE_FIX_EXAMPLES[ruleId] ?? null
}

export function linkedAxeRule(ruleId: string): string | null {
  return SEO_AXE_RULE_LINKS[ruleId] ?? null
}

export function severityColor(severity: string): string {
  if (severity === 'critical' || severity === 'serious') return 'text-red-500'
  if (severity === 'moderate') return 'text-amber-500'
  return 'text-muted'
}

export function seoTargetSummary(settings: {
  checkSeo?: boolean
  checkStructuredData?: boolean
}): string {
  if (!settings.checkSeo) return 'Off'
  return settings.checkStructuredData ? 'On + structured data' : 'On'
}
