export interface FeaturePageBannerCopy {
  description: string
}

export type FeaturePageBannerKey =
  | 'accessibility-overview'
  | 'qa-overview'
  | 'seo-overview'
  | 'accessibility-issues'
  | 'accessibility-simulator'
  | 'accessibility-simulator-detail'
  | 'accessibility-readability'
  | 'accessibility-pdfs'
  | 'accessibility-pdf-inspector'
  | 'qa-links'
  | 'qa-spelling'
  | 'qa-policies'
  | 'qa-inventory'
  | 'seo-technical'
  | 'seo-content'
  | 'seo-preview'
  | 'policies'
  | 'reports'

const COPY: Record<FeaturePageBannerKey, FeaturePageBannerCopy> = {
  'accessibility-overview': {
    description:
      'Track your site target score, conformance progress, and open WCAG issues from the latest scan. Then drill into fixes that move the score.'
  },
  'qa-overview': {
    description:
      'Review broken links, spelling, readability, and policy matches from your latest scan. Triage issues and track QA score trends over time.'
  },
  'seo-overview': {
    description:
      'Track SEO scores, technical blockers, and content issues from the latest scans. Then drill into the sites that need attention first.'
  },
  'accessibility-issues': {
    description:
      'Review open WCAG issues by rule or by page, dismiss false positives, and queue rescans for pages you are actively fixing. The list and score only include checks in your site target. Use A + AA to match Siteimprove-style reporting.'
  },
  'accessibility-simulator': {
    description:
      'Pick a site and page snapshot, then choose a vision impairment to see how the crawl screenshot is experienced.'
  },
  'accessibility-simulator-detail': {
    description:
      'Choose a vision impairment from the toolbar to filter the crawl screenshot, then review how the page may look to users.'
  },
  'accessibility-readability': {
    description:
      'Compare readability scores across pages, spot hard-to-read content, and prioritize pages that need simpler language.'
  },
  'accessibility-pdfs': {
    description:
      'Review uploaded PDF documents for accessibility problems and track remediation before republishing.'
  },
  'accessibility-pdf-inspector': {
    description:
      'Audit veraPDF findings, convert content for the web, generate an assisted structural fix, and decide whether to skip this file on future crawls.'
  },
  'qa-links': {
    description:
      'Review broken links from the latest scan, filter by URL, and dismiss false positives or mark fixes.'
  },
  'qa-spelling': {
    description:
      'Review flagged misspellings across crawled pages and dismiss intentional terms or brand names.'
  },
  'qa-policies': {
    description:
      'Review content that matched your custom rules, dismiss false positives, and mark fixes.'
  },
  'qa-inventory': {
    description:
      'Browse crawled pages and assets from the latest scan to understand your site inventory.'
  },
  'seo-technical': {
    description:
      'Review crawlability, meta tags, and technical issues that affect how search engines index your site.'
  },
  'seo-content': {
    description:
      'Review content structure, headings, and readability issues that impact search performance.'
  },
  'seo-preview': {
    description:
      'Check title tags and meta descriptions as they may appear in Google results and adjust underperforming pages.'
  },
  policies: {
    description:
      'Create keyword and pattern rules to flag sensitive or off-brand content across crawled pages.'
  },
  reports: {
    description:
      'Generate reports from your latest scans to share accessibility, QA, and SEO findings with stakeholders.'
  }
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

/** Strip site id prefix so org and site routes share the same banner key. */
export function normalizeFeatureDetailPath(path: string): string | null {
  const normalized = stripTrailingSlash(path)
  const org = normalized.match(/^\/(content|accessibility|qa|seo)(?:\/.*)?$/)
  if (org) return org[0]

  const site = normalized.match(/^\/sites\/[^/]+(\/(?:content|accessibility|qa|seo)(?:\/.*)?)$/)
  if (site?.[1]) return site[1]

  return null
}

export function resolveFeaturePageBannerKey(path: string): FeaturePageBannerKey | null {
  const normalizedPath = stripTrailingSlash(path)

  if (normalizedPath === '/accessibility' || /^\/sites\/[^/]+\/accessibility$/.test(normalizedPath)) {
    return 'accessibility-overview'
  }
  if (normalizedPath === '/qa' || /^\/sites\/[^/]+\/qa$/.test(normalizedPath)) {
    return 'qa-overview'
  }
  if (normalizedPath === '/seo' || /^\/sites\/[^/]+\/seo$/.test(normalizedPath)) {
    return 'seo-overview'
  }

  if (normalizedPath === '/policies') return 'policies'
  if (normalizedPath === '/reports') return 'reports'
  const normalized = normalizeFeatureDetailPath(normalizedPath)
  if (!normalized) return null

  if (normalized.startsWith('/accessibility/issues')) return 'accessibility-issues'
  if (/^\/accessibility\/simulator\/[^/]+/.test(normalized)) return 'accessibility-simulator-detail'
  if (normalized.startsWith('/accessibility/simulator')) return 'accessibility-simulator'
  if (normalized.startsWith('/accessibility/readability')) return 'accessibility-readability'
  if (/^\/accessibility\/pdfs\/[^/]+/.test(normalized)) return 'accessibility-pdf-inspector'
  if (normalized.startsWith('/accessibility/pdfs')) return 'accessibility-pdfs'

  if (normalized.startsWith('/qa/links')) return 'qa-links'
  if (normalized.startsWith('/qa/spelling')) return 'qa-spelling'
  if (normalized.startsWith('/qa/policies')) return 'qa-policies'
  if (normalized.startsWith('/qa/inventory')) return 'qa-inventory'

  if (normalized.startsWith('/seo/technical')) return 'seo-technical'
  if (normalized.startsWith('/seo/content')) return 'seo-content'
  if (normalized.startsWith('/seo/preview')) return 'seo-preview'

  return null
}

export function resolveFeaturePageBanner(path: string): FeaturePageBannerCopy | null {
  const key = resolveFeaturePageBannerKey(path)
  return key ? COPY[key] : null
}
