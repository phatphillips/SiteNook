import type { SeoIssueCategoryId } from '~/utils/seoIssueBreakdown'

export interface SeoCategoryGuide {
  summary: string
  steps: string[]
  ctaLabel: string
}

const GUIDES: Record<SeoIssueCategoryId, SeoCategoryGuide> = {
  technical: {
    summary:
      'Technical SEO covers page-level signals search engines use to understand and rank pages: titles, meta descriptions, canonicals, headings, and structured data.',
    steps: [
      'Open technical issues and fix the highest-severity rules first.',
      'Ensure every important page has a unique title and meta description within your length targets.',
      'Fix missing or conflicting canonical tags and heading structure.',
      'Validate structured data when product or article markup is required.',
      'Re-scan to confirm scores improve after changes.'
    ],
    ctaLabel: 'View technical issues'
  },
  crawlability: {
    summary:
      'Crawlability covers how search engines and AI crawlers discover your site: robots.txt, sitemaps, llms.txt, and related crawl directives.',
    steps: [
      'Confirm robots.txt is reachable and allows the crawlers you care about.',
      'Publish a sitemap and reference it from robots.txt.',
      'Fix blocked or missing crawl files called out in Site files.',
      'Add llms.txt if you want AI search tools to understand your site.',
      'Re-scan after publishing crawl files to verify they are found.'
    ],
    ctaLabel: 'View crawlability issues'
  },
  content: {
    summary:
      'Content SEO covers on-page quality signals such as thin content, duplicate text, and readability that affect how useful pages look to people and search engines.',
    steps: [
      'Open content issues and prioritize pages with the most traffic or conversions.',
      'Expand thin pages with clear, unique copy that answers the query.',
      'Resolve near-duplicate titles or body content across URLs.',
      'Improve readability where scores are low without stuffing keywords.',
      'Re-scan to confirm content findings clear.'
    ],
    ctaLabel: 'View content issues'
  }
}

export function seoCategoryGuide(id: SeoIssueCategoryId): SeoCategoryGuide {
  return GUIDES[id]
}
