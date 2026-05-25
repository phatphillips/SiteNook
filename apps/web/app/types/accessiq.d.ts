export interface Site {
  id: string
  name: string
  url: string
  description?: string
  crawl_schedule?: string
  default_scan_config?: Record<string, unknown>
  custom_headers?: Record<string, string>
  auth_config?: Record<string, unknown>
  created: string
  updated: string
}

export interface Scan {
  id: string
  site: string
  status: 'queued' | 'running' | 'complete' | 'failed'
  scan_type: string
  pages_crawled: number
  started_at?: string
  completed_at?: string
  wcag_version?: string
  score_a?: number
  score_aa?: number
  score_aaa?: number
  score_qa?: number
  diff_summary?: {
    new_issues: number
    fixed_issues: number
    unchanged: number
  }
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

export interface PageRecord {
  id: string
  url: string
  title?: string
  status_code?: number
  word_count?: number
  readability_score?: number
  crawl_depth?: number
}

export type WcagLevelFilter = 'All' | 'A' | 'AA' | 'AAA'

export interface IssueFilters {
  wcagVersions: string[]
  impacts: string[]
  types: string[]
  elements: string[]
  roles: string[]
  statuses: string[]
}
