export type SeoCategory = 'technical' | 'content'

export type SeoSubcategory =
  | 'on_page'
  | 'crawlability'
  | 'structured_data'
  | 'content_quality'
  | 'duplicates'

export type SeoSeverity = 'critical' | 'serious' | 'moderate' | 'minor'

export interface SeoSnapshot {
  metaDescription?: string
  canonical?: string
  robotsMeta?: string
  htmlLang?: string
  h1?: string
  h1Count?: number
  headings: number[]
  og?: { title?: string, description?: string, image?: string }
  twitter?: { card?: string }
  jsonLdTypes: string[]
  jsonLdErrors: string[]
}

export interface SeoSettings {
  checkSeo: boolean
  checkStructuredData: boolean
  seoTitleMinLength: number
  seoTitleMaxLength: number
  seoDescMinLength: number
  seoDescMaxLength: number
  thinContentWordThreshold: number
  lowReadabilityThreshold: number
}

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  checkSeo: true,
  checkStructuredData: true,
  seoTitleMinLength: 30,
  seoTitleMaxLength: 60,
  seoDescMinLength: 70,
  seoDescMaxLength: 160,
  thinContentWordThreshold: 300,
  lowReadabilityThreshold: 50
}

export interface SeoIssueDraft {
  rule_id: string
  category: SeoCategory
  subcategory: SeoSubcategory
  severity: SeoSeverity
  title: string
  description: string
  recommendation: string
  current_value?: string
  expected_value?: string
  evidence?: Record<string, unknown>
  pageUrl?: string
}

export interface InternalLinkGraph {
  /** normalized target URL → set of normalized source page URLs */
  inbound: Map<string, Set<string>>
}

export type AiBotStatus = 'allowed' | 'blocked' | 'partial'

export type SitemapDiscoveredVia = 'robots' | 'default_path' | 'scan_config'

export interface SeoCrawlAudit {
  robots: {
    found: boolean
    url: string
    status?: number
    declaresSitemap: boolean
    sitemapUrls: string[]
    summary: string
    aiBots: Record<string, AiBotStatus>
  }
  sitemap: {
    found: boolean
    url: string
    discoveredVia: SitemapDiscoveredVia
    status?: number
    validXml: boolean
    urlCount: number
    isIndex: boolean
    specialized: { image?: boolean, video?: boolean }
    summary: string
    badUrlCount?: number
    noindexCount?: number
    sampledCount?: number
    lastmodCoverage?: number
  }
  llms: {
    found: boolean
    url: string
    valid: boolean
    summary: string
  }
  checkedAt: string
}
