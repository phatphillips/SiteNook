export interface ScoreDenominatorsRecord {
  elements?: {
    image: number
    link: number
    form: number
    heading: number
    table: number
    media: number
    aria: number
    other: number
  }
  qa?: {
    totalLinks: number
    totalWords: number
    totalPages: number
  }
}

export interface Organization {
  id: string
  name: string
  subdomain: string
  plan?: OrganizationPlan
  status?: OrganizationStatus
  stripe_customer_id?: string
  stripe_subscription_id?: string
  subscription_status?: SubscriptionStatus
  closed_at?: string
  purge_scheduled_at?: string
  closed_by?: string
  created: string
  updated: string
}

export type OrganizationPlan = 'free' | 'starter' | 'team' | 'business' | 'enterprise'

export type OrganizationStatus = 'active' | 'closing'

export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled' | 'trialing'

export type SiteAccessRole = 'owner' | 'editor' | 'viewer'

export interface SiteAccess {
  id: string
  user: string
  site: string
  role: SiteAccessRole
  created: string
  updated: string
}

export interface Site {
  id: string
  name: string
  url: string
  organization?: string
  description?: string
  crawl_schedule?: string
  schedule_next_run_at?: string
  schedule_last_enqueued_at?: string
  default_scan_config?: Record<string, unknown>
  /** Reporting lens: WCAG target, QA visibility, notifications (not scan scope). */
  site_settings?: Record<string, unknown>
  /** Cached element + QA denominators from the latest completed scan (live scoring). */
  score_denominators?: ScoreDenominatorsRecord
  /** Pre-computed accessibility rollup for latest page per URL (refreshed at scan finalize). */
  current_a11y?: import('~/utils/a11ySummary').A11ySummary
  custom_headers?: Record<string, string>
  auth_config?: Record<string, unknown>
  created: string
  updated: string
}

export interface SeoCrawlAudit {
  robots: {
    found: boolean
    url: string
    status?: number
    declaresSitemap: boolean
    sitemapUrls: string[]
    summary: string
    aiBots: Record<string, 'allowed' | 'blocked' | 'partial'>
  }
  sitemap: {
    found: boolean
    url: string
    discoveredVia: 'robots' | 'default_path' | 'scan_config'
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

export interface Scan {
  id: string
  site: string
  status:
    | 'queued'
    | 'running'
    | 'background_scan'
    | 'complete'
    | 'complete_with_errors'
    | 'failed'
    | 'cancelled'
  scan_type: string
  pages_crawled: number
  started_at?: string
  completed_at?: string
  created?: string
  wcag_version?: string
  /** Siteimprove-style overall accessibility score (0–100). */
  score_overall?: number
  score_a?: number
  score_aa?: number
  score_aaa?: number
  /** Accessibility best-practice category score (0–100) for the overview “S” row. */
  score_best_practices?: number
  score_qa?: number
  score_seo?: number
  score_seo_technical?: number
  score_seo_content?: number
  score_seo_crawlability?: number
  seo_crawl_audit?: SeoCrawlAudit
  score_denominators?: ScoreDenominatorsRecord
  raw_config?: Record<string, unknown>
  error_message?: string
  open_issue_count?: number
  /** Pre-computed accessibility rollup for this scan (generated at finalize). */
  a11y_summary?: import('~/utils/a11ySummary').A11ySummary
  diff_summary?: {
    new_issues: number
    fixed_issues: number
    unchanged: number
    new_issue_ids?: string[]
    fixed_issue_keys?: string[]
  }
  unscanned_urls?: string[]
  background_retry?: {
    round: number
    index: number
    queue: string[]
  } | null
  expand?: {
    site?: Pick<Site, 'id' | 'name' | 'url'>
  }
}

export type ScanLogLevel = 'info' | 'success' | 'warn' | 'error'

export interface ScanLogEvent {
  id: string
  scan: string
  site: string
  level: ScanLogLevel
  message: string
  url?: string
  created?: string
}

export interface ScanQueueItem {
  id: string
  site: string
  status: 'pending' | 'processing' | 'complete' | 'failed' | 'cancelled'
  scan_type?: string
  raw_config?: Record<string, unknown>
  created: string
  expand?: {
    site?: Pick<Site, 'id' | 'name' | 'url'>
    requested_by?: { id: string, name?: string, email?: string }
  }
}

export type HistoryStatusFilter = 'all' | 'complete' | 'failed'

/** Unified row for the active scans table (queue + running). */
export interface ActiveScanRow {
  id: string
  recordId: string
  siteId: string
  siteName: string
  siteUrl?: string
  scanType: string
  status: string
  source: 'queue' | 'scan'
  pagesCrawled?: number
  timestamp: string
  rawConfig?: Record<string, unknown> | null
}

export interface AccessibilityIssue {
  id: string
  scan: string
  page: string
  rule_id: string
  wcag_level: 'A' | 'AA' | 'AAA'
  wcag_sc?: string
  wcag_version?: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  type: 'error' | 'warning' | 'review'
  element_type?: string
  responsible_role?: string
  help_url?: string
  description: string
  html_snippet?: string
  css_selector?: string
  fix_suggestion?: string
  status: 'open' | 'dismissed' | 'fixed'
  dismissed_at?: string
  dismiss_reason?: string
  updated?: string
  created?: string
  expand?: {
    page?: { url: string, title?: string }
  }
}

export interface Policy {
  id: string
  site?: string
  name: string
  description?: string
  rule_type: string
  pattern: string
  category: string
  severity: string
  enabled: boolean
}

export interface BrokenLink {
  id: string
  scan: string
  page: string
  href: string
  status_code: number
  link_type: string
  status: string
  expand?: { page?: { url: string } }
}

export interface SpellingIssue {
  id: string
  word: string
  context: string
  confidence: string
  status: string
  expand?: { page?: { url: string } }
}

export type SeoIssueCategory = 'technical' | 'content'

export interface SeoIssue {
  id: string
  scan: string
  site: string
  page?: string
  rule_id: string
  category: SeoIssueCategory
  subcategory?: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  status: 'open' | 'dismissed' | 'fixed'
  title: string
  description?: string
  recommendation?: string
  current_value?: string
  expected_value?: string
  evidence?: Record<string, unknown>
  dismissed_at?: string
  dismiss_reason?: string
  updated?: string
  created?: string
  expand?: {
    page?: { url: string, title?: string }
  }
}

export interface PageRecord {
  id: string
  url: string
  title?: string
  status_code?: number
  word_count?: number
  readability_score?: number
  readability_scores?: Record<string, number | null> | string
  html_snapshot?: string
  crawl_depth?: number
  seo_snapshot?: Record<string, unknown>
  created?: string
  scan?: string
  expand?: {
    scan?: Scan
  }
}

export type InventoryPageBadge = 'new' | 'updated' | 'pending' | null

export interface InventoryPageRow extends PageRecord {
  inventoryBadge?: InventoryPageBadge
  last_modified?: string
}

export type SiteSitemapSource = 'blank' | 'crawl' | 'xml' | 'duplicate'

export interface SitemapViewport {
  x: number
  y: number
  zoom: number
}

export interface SitemapNode {
  id: string
  parentId: string | null
  label: string
  url: string
  notes?: string
  lastmod?: string
  statusCode?: number
  crawlDepth?: number
  position?: { x: number, y: number }
  collapsed?: boolean
}

export interface SitemapEdge {
  id: string
  source: string
  target: string
}

export interface SitemapGraph {
  nodes: SitemapNode[]
  edges: SitemapEdge[]
  viewport?: SitemapViewport
}

export interface SiteSitemap {
  id: string
  site: string
  name: string
  source: SiteSitemapSource
  graph: SitemapGraph
  created_by?: string
  created: string
  updated: string
}

export type WcagLevelFilter = 'All' | 'A' | 'AA' | 'AAA'

export type PdfDocumentStatus = 'pending' | 'processing' | 'complete' | 'failed'
export type PdfDocumentSource = 'upload' | 'crawl'
export type PdfIssueCategory = 'document' | 'element'

export interface PdfDocument {
  id: string
  site: string
  source: PdfDocumentSource
  file?: string
  url?: string
  inventory?: string
  filename?: string
  document_title?: string
  status: PdfDocumentStatus
  machine_readable?: boolean
  has_pdf_tags?: boolean
  issue_count?: number
  accessibility_score?: number
  share_token?: string
  uploaded_by?: string
  validated_at?: string
  error_message?: string
  report_summary?: Record<string, unknown>
  pdf_metadata?: Record<string, unknown>
  text_content?: string
  created?: string
  updated?: string
}

export interface PdfIssue {
  id: string
  pdf_document: string
  category: PdfIssueCategory
  rule_id: string
  title: string
  description?: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  page_number?: number
  occurrence_count?: number
  evidence?: Record<string, unknown>
}

export interface IssueFilters {
  wcagVersions: string[]
  /** Multi-select WCAG level pills (A, AA, AAA). Empty = all levels. */
  wcagLevels: string[]
  /** Target category filter (aria, best_practice). Empty = all categories. */
  targetCategories: import('~/utils/siteSettings').IssueTargetCategory[]
  impacts: string[]
  types: string[]
  elements: string[]
  roles: string[]
  statuses: string[]
}
