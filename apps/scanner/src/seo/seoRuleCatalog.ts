import type { SeoCategory, SeoSeverity, SeoSubcategory } from './types.js'

export interface SeoRuleMeta {
  rule_id: string
  category: SeoCategory
  subcategory: SeoSubcategory
  severity: SeoSeverity
  title: string
  recommendation: string
  fixExample?: string
}

export const SEO_RULE_CATALOG: Record<string, SeoRuleMeta> = {
  'missing-canonical': {
    rule_id: 'missing-canonical',
    category: 'technical',
    subcategory: 'on_page',
    severity: 'moderate',
    title: 'Missing canonical URL',
    recommendation: 'Add a <link rel="canonical"> tag pointing to the preferred URL for this page.'
  },
  'canonical-off-domain': {
    rule_id: 'canonical-off-domain',
    category: 'technical',
    subcategory: 'on_page',
    severity: 'serious',
    title: 'Canonical URL points off-site',
    recommendation: 'Ensure the canonical URL belongs to your site unless this page is intentionally consolidated elsewhere.'
  },
  'robots-noindex': {
    rule_id: 'robots-noindex',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'moderate',
    title: 'Page blocked from indexing',
    recommendation: 'Remove noindex from robots meta if this page should appear in search results.'
  },
  'missing-html-lang': {
    rule_id: 'missing-html-lang',
    category: 'technical',
    subcategory: 'on_page',
    severity: 'moderate',
    title: 'Missing HTML language',
    recommendation: 'Add a lang attribute on the <html> element (e.g. lang="en").'
  },
  'missing-og-title': {
    rule_id: 'missing-og-title',
    category: 'technical',
    subcategory: 'on_page',
    severity: 'minor',
    title: 'Missing Open Graph title',
    recommendation: 'Add og:title for better social sharing previews.'
  },
  'missing-og-description': {
    rule_id: 'missing-og-description',
    category: 'technical',
    subcategory: 'on_page',
    severity: 'minor',
    title: 'Missing Open Graph description',
    recommendation: 'Add og:description for better social sharing previews.'
  },
  'missing-og-image': {
    rule_id: 'missing-og-image',
    category: 'technical',
    subcategory: 'on_page',
    severity: 'minor',
    title: 'Missing Open Graph image',
    recommendation: 'Add og:image so shared links show a preview image.'
  },
  'invalid-json-ld': {
    rule_id: 'invalid-json-ld',
    category: 'technical',
    subcategory: 'structured_data',
    severity: 'serious',
    title: 'Invalid structured data (JSON-LD)',
    recommendation: 'Fix JSON-LD syntax errors so search engines can parse structured data.'
  },
  'missing-json-ld': {
    rule_id: 'missing-json-ld',
    category: 'technical',
    subcategory: 'structured_data',
    severity: 'minor',
    title: 'No structured data found',
    recommendation: 'Consider adding JSON-LD for key page types (e.g. WebPage, Organization).'
  },
  'http-internal-link': {
    rule_id: 'http-internal-link',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'moderate',
    title: 'Insecure internal link on HTTPS site',
    recommendation: 'Update internal links to use https:// for consistency and security.'
  },
  'orphan-page': {
    rule_id: 'orphan-page',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'moderate',
    title: 'Orphan page',
    recommendation: 'Add internal links from other pages so crawlers and users can discover this URL.'
  },
  'page-not-in-sitemap': {
    rule_id: 'page-not-in-sitemap',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'moderate',
    title: 'Page not listed in sitemap',
    recommendation: 'Add this URL to your XML sitemap so search engines can discover it.'
  },
  'robots-unreachable': {
    rule_id: 'robots-unreachable',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'serious',
    title: 'robots.txt not reachable',
    recommendation: 'Ensure /robots.txt returns HTTP 200 so crawlers receive crawl directives.',
    fixExample: 'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml'
  },
  'robots-missing-sitemap-directive': {
    rule_id: 'robots-missing-sitemap-directive',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'moderate',
    title: 'No Sitemap directive in robots.txt',
    recommendation: 'Add a Sitemap: line pointing to your XML sitemap.',
    fixExample: 'Sitemap: https://example.com/sitemap.xml'
  },
  'sitemap-unreachable': {
    rule_id: 'sitemap-unreachable',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'serious',
    title: 'Sitemap not reachable',
    recommendation: 'Fix the sitemap URL so it returns HTTP 200 with valid XML.'
  },
  'sitemap-invalid-xml': {
    rule_id: 'sitemap-invalid-xml',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'serious',
    title: 'Invalid sitemap XML',
    recommendation: 'Ensure the sitemap uses the sitemaps.org urlset or sitemapindex namespace.'
  },
  'sitemap-over-limit': {
    rule_id: 'sitemap-over-limit',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'serious',
    title: 'Sitemap exceeds size limits',
    recommendation: 'Split into multiple sitemaps (max 50,000 URLs or 50MB each) and use a sitemap index.'
  },
  'sitemap-relative-url': {
    rule_id: 'sitemap-relative-url',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'moderate',
    title: 'Relative URLs in sitemap',
    recommendation: 'Use absolute http(s) URLs in every <loc> element.'
  },
  'sitemap-bad-urls': {
    rule_id: 'sitemap-bad-urls',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'serious',
    title: 'Sitemap lists URLs that return errors',
    recommendation: 'Remove or fix URLs in the sitemap that return 4xx errors or redirect.'
  },
  'sitemap-noindex-urls': {
    rule_id: 'sitemap-noindex-urls',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'serious',
    title: 'Sitemap lists noindex pages',
    recommendation: 'Remove noindex pages from the sitemap — they should not be submitted for indexing.'
  },
  'sitemap-missing-lastmod': {
    rule_id: 'sitemap-missing-lastmod',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'minor',
    title: 'Most sitemap entries lack lastmod',
    recommendation: 'Add <lastmod> dates to help search engines prioritize fresh content.'
  },
  'sitemap-stale-lastmod': {
    rule_id: 'sitemap-stale-lastmod',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'minor',
    title: 'Identical lastmod on all sitemap entries',
    recommendation: 'Use real last-modified dates instead of a static placeholder.'
  },
  'sitemap-index-missing': {
    rule_id: 'sitemap-index-missing',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'minor',
    title: 'Multiple sitemaps without index file',
    recommendation: 'Use a sitemap index file to reference child sitemaps.'
  },
  'llms-missing': {
    rule_id: 'llms-missing',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'moderate',
    title: 'llms.txt not found',
    recommendation: 'Add /llms.txt with a site summary and links for AI crawlers.',
    fixExample: '# Example Site\n\n> A brief description of your site.\n\n## Docs\n- [Home](https://example.com/)'
  },
  'llms-invalid-format': {
    rule_id: 'llms-invalid-format',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'minor',
    title: 'llms.txt missing summary or links',
    recommendation: 'Include a site description and at least one link in llms.txt.'
  },
  'ai-bot-blocked': {
    rule_id: 'ai-bot-blocked',
    category: 'technical',
    subcategory: 'crawlability',
    severity: 'moderate',
    title: 'AI search bot blocked in robots.txt',
    recommendation: 'Review robots.txt if you want AI search engines to index your content.'
  },
  'missing-organization-schema': {
    rule_id: 'missing-organization-schema',
    category: 'technical',
    subcategory: 'structured_data',
    severity: 'minor',
    title: 'No Organization schema on homepage',
    recommendation: 'Add Organization or LocalBusiness JSON-LD on your homepage.',
    fixExample: '<script type="application/ld+json">\n{"@context":"https://schema.org","@type":"Organization","name":"Example Inc","url":"https://example.com"}\n</script>'
  },
  'missing-faq-schema': {
    rule_id: 'missing-faq-schema',
    category: 'technical',
    subcategory: 'structured_data',
    severity: 'minor',
    title: 'FAQ content without FAQPage schema',
    recommendation: 'Add FAQPage JSON-LD when the page has FAQ-style content.'
  },
  'duplicate-title': {
    rule_id: 'duplicate-title',
    category: 'content',
    subcategory: 'duplicates',
    severity: 'serious',
    title: 'Duplicate page title',
    recommendation: 'Give each page a unique, descriptive title tag.'
  },
  'duplicate-meta-description': {
    rule_id: 'duplicate-meta-description',
    category: 'content',
    subcategory: 'duplicates',
    severity: 'moderate',
    title: 'Duplicate meta description',
    recommendation: 'Write a unique meta description for each page.'
  },
  'missing-title': {
    rule_id: 'missing-title',
    category: 'content',
    subcategory: 'content_quality',
    severity: 'critical',
    title: 'Missing page title',
    recommendation: 'Add a descriptive <title> tag in the document head.',
    fixExample: '<title>Descriptive page title — Brand Name</title>'
  },
  'title-too-short': {
    rule_id: 'title-too-short',
    category: 'content',
    subcategory: 'content_quality',
    severity: 'moderate',
    title: 'Title too short',
    recommendation: 'Expand the title to clearly describe the page topic.'
  },
  'title-too-long': {
    rule_id: 'title-too-long',
    category: 'content',
    subcategory: 'content_quality',
    severity: 'minor',
    title: 'Title too long',
    recommendation: 'Shorten the title so it is not truncated in search results.'
  },
  'missing-meta-description': {
    rule_id: 'missing-meta-description',
    category: 'content',
    subcategory: 'content_quality',
    severity: 'serious',
    title: 'Missing meta description',
    recommendation: 'Add a meta description summarizing the page for search snippets.',
    fixExample: '<meta name="description" content="A concise summary of this page for search results.">'
  },
  'description-too-short': {
    rule_id: 'description-too-short',
    category: 'content',
    subcategory: 'content_quality',
    severity: 'moderate',
    title: 'Meta description too short',
    recommendation: 'Expand the meta description to better summarize the page.'
  },
  'description-too-long': {
    rule_id: 'description-too-long',
    category: 'content',
    subcategory: 'content_quality',
    severity: 'minor',
    title: 'Meta description too long',
    recommendation: 'Shorten the meta description to avoid truncation in search results.'
  },
  'missing-h1': {
    rule_id: 'missing-h1',
    category: 'content',
    subcategory: 'content_quality',
    severity: 'serious',
    title: 'Missing H1 heading',
    recommendation: 'Add a single H1 that describes the main topic of the page.'
  },
  'multiple-h1': {
    rule_id: 'multiple-h1',
    category: 'content',
    subcategory: 'content_quality',
    severity: 'moderate',
    title: 'Multiple H1 headings',
    recommendation: 'Use one H1 per page and demote extra headings to H2 or lower.'
  },
  'heading-skip-level': {
    rule_id: 'heading-skip-level',
    category: 'content',
    subcategory: 'content_quality',
    severity: 'moderate',
    title: 'Skipped heading level',
    recommendation: 'Use sequential heading levels (e.g. H2 then H3) without skipping.'
  },
  'thin-content': {
    rule_id: 'thin-content',
    category: 'content',
    subcategory: 'content_quality',
    severity: 'moderate',
    title: 'Thin content',
    recommendation: 'Add substantive copy so the page provides clear value to visitors.'
  },
  'low-readability': {
    rule_id: 'low-readability',
    category: 'content',
    subcategory: 'content_quality',
    severity: 'minor',
    title: 'Low readability score',
    recommendation: 'Simplify sentences and structure to improve readability.'
  }
}

export function ruleMeta(ruleId: string): SeoRuleMeta {
  return SEO_RULE_CATALOG[ruleId] ?? {
    rule_id: ruleId,
    category: 'technical',
    subcategory: 'on_page',
    severity: 'moderate',
    title: ruleId,
    recommendation: 'Review and fix this SEO issue.'
  }
}
