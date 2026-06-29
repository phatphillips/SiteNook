import { ruleFixExample, ruleWhyItMatters } from '~/utils/seoRules'

export interface SeoIssueDescription {
  description: string
  fix: string
}

const SEO_ISSUE_DESCRIPTIONS: Record<string, SeoIssueDescription> = {
  'missing-canonical': {
    description: 'No canonical URL tag is defined for this page.',
    fix: 'Add a <link rel="canonical" href="..."> tag in the page <head>.'
  },
  'missing-meta-description': {
    description: 'This page has no meta description tag.',
    fix: 'Add a <meta name="description" content="..."> tag under 157 characters.'
  },
  'duplicate-title': {
    description: 'Multiple pages share the same <title> tag value.',
    fix: 'Ensure each page has a unique, descriptive title.'
  },
  'missing-h1': {
    description: 'No H1 heading was found on this page.',
    fix: 'Add a single H1 tag that describes the primary content of the page.'
  },
  'sitemap-invalid-xml': {
    description: 'The sitemap.xml file could not be parsed.',
    fix: 'Validate your sitemap at https://www.xml-sitemaps.com/validate-xml-sitemap.html'
  },
  'robots-missing-sitemap-directive': {
    description: 'The robots.txt file does not reference the sitemap URL.',
    fix: 'Add "Sitemap: https://yourdomain.com/sitemap.xml" to robots.txt.'
  },
  'canonical-off-domain': {
    description: 'The canonical URL points to a different domain.',
    fix: 'Set the canonical href to the preferred URL on your own site.'
  },
  'robots-noindex': {
    description: 'This page is marked noindex and may be excluded from search results.',
    fix: 'Remove noindex from the robots meta tag if the page should be indexed.'
  },
  'missing-html-lang': {
    description: 'The HTML document has no lang attribute.',
    fix: 'Add lang="en" (or the correct language) on the <html> element.'
  },
  'missing-title': {
    description: 'This page has no <title> tag in the document head.',
    fix: 'Add a unique, descriptive <title> tag.'
  },
  'title-too-short': {
    description: 'The page title is shorter than recommended.',
    fix: 'Expand the title to clearly describe the page topic.'
  },
  'title-too-long': {
    description: 'The page title may be truncated in search results.',
    fix: 'Shorten the title to roughly 50–60 characters.'
  },
  'description-too-short': {
    description: 'The meta description is shorter than recommended.',
    fix: 'Expand the description to 70–160 characters with a compelling summary.'
  },
  'description-too-long': {
    description: 'The meta description may be truncated in search snippets.',
    fix: 'Shorten the meta description to under 160 characters.'
  },
  'multiple-h1': {
    description: 'More than one H1 heading was found on this page.',
    fix: 'Use a single H1 and demote additional headings to H2 or lower.'
  },
  'heading-skip-level': {
    description: 'Heading levels skip a step (e.g. H2 followed by H4).',
    fix: 'Use sequential heading levels without skipping.'
  },
  'duplicate-meta-description': {
    description: 'Multiple pages share the same meta description.',
    fix: 'Write a unique meta description for each page.'
  },
  'thin-content': {
    description: 'This page has very little text content.',
    fix: 'Add substantive copy that clearly answers the visitor\'s intent.'
  },
  'low-readability': {
    description: 'The page readability score is below the recommended threshold.',
    fix: 'Use shorter sentences and simpler vocabulary where appropriate.'
  },
  'orphan-page': {
    description: 'No internal links point to this page.',
    fix: 'Add links from other relevant pages so crawlers can discover this URL.'
  },
  'page-not-in-sitemap': {
    description: 'This page is not listed in the XML sitemap.',
    fix: 'Add the URL to your sitemap or verify the sitemap includes all indexable pages.'
  },
  'robots-unreachable': {
    description: 'The robots.txt file could not be fetched.',
    fix: 'Ensure /robots.txt returns HTTP 200 with valid crawl directives.'
  },
  'sitemap-unreachable': {
    description: 'The XML sitemap could not be fetched.',
    fix: 'Fix the sitemap URL so it returns HTTP 200 with valid XML.'
  },
  'sitemap-over-limit': {
    description: 'The sitemap exceeds the maximum URL or file size limit.',
    fix: 'Split into multiple sitemaps and reference them with a sitemap index.'
  },
  'invalid-json-ld': {
    description: 'Structured data on this page has JSON-LD syntax errors.',
    fix: 'Fix JSON-LD markup and validate with Google\'s Rich Results Test.'
  },
  'missing-json-ld': {
    description: 'No structured data (JSON-LD) was found on this page.',
    fix: 'Add JSON-LD for key page types such as WebPage or Organization.'
  },
  'http-internal-link': {
    description: 'An internal link uses HTTP on an HTTPS site.',
    fix: 'Update internal links to use https:// URLs.'
  },
  'llms-missing': {
    description: 'No llms.txt file was found at the site root.',
    fix: 'Add /llms.txt with a site summary and key links for AI crawlers.'
  },
  'ai-bot-blocked': {
    description: 'An AI search bot is blocked in robots.txt.',
    fix: 'Review robots.txt if you want AI search engines to index your content.'
  }
}

export function seoIssueDescription(ruleId: string): SeoIssueDescription {
  const entry = SEO_ISSUE_DESCRIPTIONS[ruleId]
  if (entry) return entry
  const fix = ruleFixExample(ruleId)
  return {
    description: ruleWhyItMatters(ruleId),
    fix: fix ?? 'Review the issue details and apply the recommended fix.'
  }
}

export function useSeoIssueDescriptions() {
  return {
    descriptions: SEO_ISSUE_DESCRIPTIONS,
    getDescription: seoIssueDescription
  }
}
