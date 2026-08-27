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
  trial_ends_at?: string
  trial_nudge_stage?: number
  onboarding_state?: OrganizationOnboardingState | null
  closed_at?: string
  purge_scheduled_at?: string
  closed_by?: string
  created: string
  updated: string
}

export interface OrganizationOnboardingState {
  dismissed?: boolean
  siteAdded?: boolean
  firstScanStarted?: boolean
  ahaSeen?: boolean
  teammateInvited?: boolean
  scheduleEnabled?: boolean
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
  /** Per-section AI handoff prompts + history (Content Explorer). */
  handoff_prompts?: import('~/utils/handoffSectionPrompts').HandoffPromptsRecord
  /** Cached element + QA denominators from the latest completed scan (live scoring). */
  score_denominators?: ScoreDenominatorsRecord
  /** Pre-computed accessibility rollup for latest page per URL (refreshed at scan finalize). */
  current_a11y?: import('~/utils/a11ySummary').A11ySummary
  custom_headers?: Record<string, string>
  auth_config?: Record<string, unknown>
  created: string
  updated: string
}

export type AiHandoffSection = import('~/utils/handoffSectionPrompts').HandoffSectionId

export interface AiHandoffPack {
  id: string
  org: string
  site: string
  section: AiHandoffSection
  prompt_snapshot?: string
  page_urls?: string[]
  page_count?: number
  artifact?: string
  created_by?: string
  created: string
  updated: string
}

export interface SiteDashboardSummary {
  id: string
  site: string
  org: string
  avg_accessibility?: number
  avg_qa?: number
  avg_seo?: number
  open_a11y_count?: number
  open_qa_count?: number
  open_seo_count?: number
  attention_worst_score?: number
  attention_open_total?: number
  attention_last_scan_at?: string
  source_scan_at?: string
  created: string
  updated: string
}

export interface OrgDashboardSummary {
  id: string
  org: string
  avg_accessibility?: number
  avg_qa?: number
  avg_seo?: number
  open_a11y_count?: number
  open_qa_count?: number
  open_seo_count?: number
  attention_worst_score?: number
  attention_open_total?: number
  attention_last_scan_at?: string
  source_scan_at?: string
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
  queued_at?: string
  crawl_finished_at?: string
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
  /** Non-dismissed broken links for this scan (written at finalize). */
  broken_link_count?: number
  /** Open SEO issues for this scan (hydrated in org/site SEO trends; not a stored field). */
  open_seo_count?: number
  /** Pre-computed accessibility rollup for this scan (generated at finalize). */
  a11y_summary?: import('~/utils/a11ySummary').A11ySummary
  /** Axe check catalog + pass/fail counts used for Siteimprove-style scoring. */
  a11y_check_stats?: import('~/utils/a11yCheckStats').A11yCheckStats
  /** Crawl quality snapshot. Untrusted scans must not replace the site score. */
  scan_quality?: {
    pages_attempted: number
    pages_saved: number
    axe_failed: number
    http_errors: number
    timeouts: number
    network_errors: number
    trusted: boolean
    reason?: string
  }
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
  dismissed_by?: string
  dismissed_at?: string
  dismiss_reason?: string
  updated?: string
  created?: string
  expand?: {
    page?: { url: string, title?: string }
  }
}

export type A11yIssueActionType = 'dismissed' | 'fixed' | 'reopened'
export type A11yIssueActionScope = 'rule' | 'page'

export interface AccessibilityIssueAction {
  id: string
  organization: string
  site: string
  actor?: string
  action: A11yIssueActionType
  scope: A11yIssueActionScope
  rule_id: string
  description?: string
  impact?: 'critical' | 'serious' | 'moderate' | 'minor'
  wcag_level?: 'A' | 'AA' | 'AAA'
  page_url?: string
  page_title?: string
  dismiss_reason?: string
  issue_ids?: string[]
  logged_at: string
  expand?: {
    actor?: { id: string, name?: string, email?: string }
    site?: { id: string, name?: string }
  }
}

export interface Policy {
  id: string
  organization?: string
  /** Empty / missing = applies to all sites in the organization. */
  site?: string
  name: string
  description?: string
  /**
   * flag_content → write policy_matches from HTML patterns.
   * exclude_from_accessibility → CSS selectors excluded from axe at scan time.
   */
  kind: 'flag_content' | 'exclude_from_accessibility'
  rule_type: 'keyword' | 'regex' | 'html_attribute' | 'css_selector'
  pattern: string
  category: 'qa' | 'accessibility' | 'brand' | 'security'
  severity: 'error' | 'warning'
  enabled: boolean
  expand?: {
    site?: { id: string, name: string }
  }
}

export interface PolicyMatch {
  id: string
  scan: string
  policy: string
  page: string
  matched_text: string
  context: string
  status: 'open' | 'dismissed' | 'fixed'
  expand?: {
    page?: { url: string, title?: string }
    policy?: Pick<Policy, 'id' | 'name' | 'category' | 'severity' | 'pattern' | 'rule_type'>
  }
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
  html_size_bytes?: number
  preview_image?: string
  rendered_html?: string
  tab_order?: {
    pageWidth: number
    pageHeight: number
    entries: Array<{
      index: number
      tag: string
      role: string
      name: string
      x: number
      y: number
      width: number
      height: number
    }>
  }
  crawl_depth?: number
  seo_snapshot?: Record<string, unknown>
  created?: string
  scan?: string
  site?: string
  content_unchanged?: boolean
  content_hash?: string
  content_blob?: string
  expand?: {
    scan?: Scan
  }
}

export interface ContentExplorerEntry {
  id: string
  pageId?: string
  url: string
  title: string
  blobId?: string
  unchanged: boolean
  hasContent: boolean
  failed: boolean
}

export interface ContentExplorerTreeNode {
  id: string
  label: string
  path: string
  /** Present when a crawled page exists at this path (including parents with children). */
  entry?: ContentExplorerEntry
  children?: ContentExplorerTreeNode[]
}

export type InventoryPageBadge = 'new' | 'updated' | 'pending' | null

export interface InventoryPageRow extends PageRecord {
  inventoryBadge?: InventoryPageBadge
  last_modified?: string
}

export interface InventorySourcePageSummary {
  url: string
  title?: string
}

export interface InventoryAssetRow extends Record<string, unknown> {
  url: string
  found_on_page_count?: number | null
  siteId?: string
  siteName?: string
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
export type PdfStructureStatus = 'none' | 'pending' | 'processing' | 'complete' | 'failed'
export type PdfRemediationStatus = 'none' | 'pending' | 'processing' | 'complete' | 'failed'

export interface PdfStructureOutlineItem {
  id: string | number
  type: string
  page?: number
  content?: string
  level?: number | string
  bbox?: number[]
}

export interface PdfStructureOutline {
  elementCount: number
  types: Record<string, number>
  items: PdfStructureOutlineItem[]
}

export interface PdfDocument {
  id: string
  /** Optional — crawl PDFs and site uploads have a site; org library uploads may not. */
  site?: string
  organization?: string
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
  /** SHA-256 of stored PDF bytes — used for crawl/upload dedup. */
  content_hash?: string
  uploaded_by?: string
  validated_at?: string
  /** When true, skip auto-enqueue on future site crawls. */
  ignored?: boolean
  ignored_at?: string
  error_message?: string
  report_summary?: Record<string, unknown>
  pdf_metadata?: Record<string, unknown>
  text_content?: string
  structure_status?: PdfStructureStatus
  structure_extracted_at?: string
  structure_error?: string
  structure_outline?: PdfStructureOutline
  structure_json?: string
  structure_html?: string
  structure_markdown?: string
  latest_remediation_id?: string
  remediation_status?: PdfRemediationStatus
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

export interface PdfRemediation {
  id: string
  pdf_document: string
  site: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  engine?: string
  artifact_kind?: 'suggested_tagged' | 'pdf_ua_export'
  file?: string
  before_score?: number
  after_score?: number
  before_issue_count?: number
  after_issue_count?: number
  issue_delta?: number
  duration_ms?: number
  error_message?: string
  summary?: Record<string, unknown>
  created?: string
  updated?: string
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

export type AnalyticsProvider =
  | 'ga4'
  | 'cloudflare'
  | 'plausible'
  | 'umami'
  | 'fathom'
  | 'matomo'

export type AnalyticsConnectionStatus =
  | 'connected'
  | 'error'
  | 'needs_reconnect'
  | 'disconnected'

export type AnalyticsSyncStatus =
  | 'ok'
  | 'auth_error'
  | 'rate_limited'
  | 'provider_error'

export interface AnalyticsCredentialsMeta {
  hasRefreshToken?: boolean
  last4?: string
  instanceUrlHost?: string
  propertyLabel?: string
  [key: string]: unknown
}

export interface AnalyticsExternalIds {
  propertyId?: string
  zoneId?: string
  siteId?: string
  websiteId?: string
  [key: string]: string | undefined
}

export interface AnalyticsConnection {
  id: string
  organization: string
  site: string
  provider: AnalyticsProvider
  status: AnalyticsConnectionStatus
  credentials_meta?: AnalyticsCredentialsMeta | null
  external_ids?: AnalyticsExternalIds | null
  last_synced_at?: string
  last_sync_status?: AnalyticsSyncStatus
  last_error?: string
  next_sync_at?: string
  sync_interval_hours?: number
  created: string
  updated: string
  expand?: {
    site?: Site
  }
}

export interface NormalizedAnalyticsSummary {
  sessions: number | null
  visitors: number | null
  pageviews: number | null
  bounceRate: number | null
  engagementRate: number | null
  topPages: Array<{ path: string, pageviews: number | null }> | null
  topSources: Array<{ source: string, visitors: number | null }> | null
  timezone: string | null
  asOf: string
}

export interface AnalyticsSnapshot {
  id: string
  organization: string
  site: string
  connection: string
  range_start: string
  range_end: string
  granularity: 'daily' | 'range'
  metrics?: NormalizedAnalyticsSummary | null
  created: string
  updated: string
}
