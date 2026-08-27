import { subDays } from 'date-fns'
import type { AccessibilityIssue, Scan } from '~/types/sitenook'
import type { SiteDashboardSnapshot } from '~/utils/dashboardAggregates'
import type { ReadabilityPageRow, ReadabilityScores } from '~/utils/readabilityMethods'
import type { CrawlLogLevel } from '~/utils/crawlLog'

const DEMO_SITE_ID = 'demo-site'
const DEMO_SCAN_ID = 'demo-scan-latest'

function daysAgoIso(days: number): string {
  return subDays(new Date(), days).toISOString()
}

/** Synthetic completed scans for 30-day score / issues trend charts. Issues trend down (good). */
export const MARKETING_DEMO_SCANS: Scan[] = [
  { id: 'demo-scan-29', site: DEMO_SITE_ID, status: 'complete', scan_type: 'full', pages_crawled: 48, completed_at: daysAgoIso(28), score_aa: 71, score_a: 74, score_overall: 72, score_qa: 68, score_seo: 64, open_issue_count: 48 },
  { id: 'demo-scan-22', site: DEMO_SITE_ID, status: 'complete', scan_type: 'full', pages_crawled: 52, completed_at: daysAgoIso(21), score_aa: 74, score_a: 76, score_overall: 75, score_qa: 72, score_seo: 68, open_issue_count: 36 },
  { id: 'demo-scan-15', site: DEMO_SITE_ID, status: 'complete', scan_type: 'full', pages_crawled: 55, completed_at: daysAgoIso(14), score_aa: 78, score_a: 80, score_overall: 79, score_qa: 76, score_seo: 72, open_issue_count: 24 },
  { id: 'demo-scan-8', site: DEMO_SITE_ID, status: 'complete', scan_type: 'full', pages_crawled: 58, completed_at: daysAgoIso(7), score_aa: 81, score_a: 83, score_overall: 82, score_qa: 80, score_seo: 76, open_issue_count: 14 },
  { id: DEMO_SCAN_ID, site: DEMO_SITE_ID, status: 'complete', scan_type: 'full', pages_crawled: 61, completed_at: daysAgoIso(1), score_aa: 84, score_a: 86, score_overall: 85, score_qa: 83, score_seo: 79, score_seo_technical: 81, score_seo_content: 77, open_issue_count: 5 }
]

/** Pages-with-issues counts per demo scan (also trending down). */
export const MARKETING_DEMO_PAGES_WITH_ISSUES_BY_SCAN = new Map<string, number>([
  ['demo-scan-29', 31],
  ['demo-scan-22', 24],
  ['demo-scan-15', 17],
  ['demo-scan-8', 11],
  [DEMO_SCAN_ID, 5]
])

export const MARKETING_DEMO_ISSUES: AccessibilityIssue[] = [
  {
    id: 'demo-issue-1',
    scan: DEMO_SCAN_ID,
    page: 'demo-page-1',
    rule_id: 'image-alt',
    wcag_level: 'A',
    wcag_sc: '1.1.1',
    impact: 'critical',
    type: 'error',
    description: 'Images must have alternate text',
    status: 'open',
    expand: { page: { url: 'https://example.com/', title: 'Home' } }
  },
  {
    id: 'demo-issue-2',
    scan: DEMO_SCAN_ID,
    page: 'demo-page-2',
    rule_id: 'color-contrast',
    wcag_level: 'AA',
    wcag_sc: '1.4.3',
    impact: 'serious',
    type: 'error',
    description: 'Elements must meet minimum color contrast ratio thresholds',
    status: 'open',
    expand: { page: { url: 'https://example.com/services', title: 'Services' } }
  },
  {
    id: 'demo-issue-3',
    scan: DEMO_SCAN_ID,
    page: 'demo-page-3',
    rule_id: 'label',
    wcag_level: 'A',
    wcag_sc: '1.3.1',
    impact: 'serious',
    type: 'error',
    description: 'Form elements must have labels',
    status: 'open',
    expand: { page: { url: 'https://example.com/contact', title: 'Contact' } }
  },
  {
    id: 'demo-issue-4',
    scan: DEMO_SCAN_ID,
    page: 'demo-page-4',
    rule_id: 'link-name',
    wcag_level: 'A',
    wcag_sc: '2.4.4',
    impact: 'moderate',
    type: 'error',
    description: 'Links must have discernible text',
    status: 'open',
    expand: { page: { url: 'https://example.com/blog', title: 'Blog' } }
  },
  {
    id: 'demo-issue-5',
    scan: DEMO_SCAN_ID,
    page: 'demo-page-5',
    rule_id: 'heading-order',
    wcag_level: 'AA',
    wcag_sc: '1.3.1',
    impact: 'moderate',
    type: 'warning',
    description: 'Heading levels should only increase by one',
    status: 'open',
    expand: { page: { url: 'https://example.com/about', title: 'About' } }
  }
]

export const MARKETING_DEMO_POINTS_TO_GAIN = new Map<string, number>([
  ['image-alt', 4.2],
  ['color-contrast', 3.1],
  ['label', 2.4],
  ['link-name', 1.6],
  ['heading-order', 0.8]
])

export const MARKETING_DEMO_PAGES_BY_RULE = new Map<string, string[]>([
  ['image-alt', ['https://example.com/', 'https://example.com/services', 'https://example.com/blog']],
  ['color-contrast', ['https://example.com/services', 'https://example.com/contact']],
  ['label', ['https://example.com/contact']],
  ['link-name', ['https://example.com/blog', 'https://example.com/about']],
  ['heading-order', ['https://example.com/about']]
])

export const MARKETING_DEMO_ATTENTION_SITES: SiteDashboardSnapshot[] = [
  {
    siteId: 'demo-acme',
    siteName: 'Acme Research',
    siteUrl: 'https://acme.example',
    accessibilityScore: 72,
    qaScore: 68,
    seoScore: 74,
    openA11yIssues: 48,
    openQaIssues: 31,
    openSeoIssues: 22,
    brokenLinkCount: 18,
    misspellingCount: 13,
    technicalSeoCount: 14,
    contentSeoCount: 8,
    lastScanAt: daysAgoIso(1)
  },
  {
    siteId: 'demo-northwind',
    siteName: 'Northwind Docs',
    siteUrl: 'https://docs.northwind.example',
    accessibilityScore: 81,
    qaScore: 79,
    seoScore: 83,
    openA11yIssues: 19,
    openQaIssues: 12,
    openSeoIssues: 9,
    brokenLinkCount: 7,
    misspellingCount: 5,
    technicalSeoCount: 5,
    contentSeoCount: 4,
    lastScanAt: daysAgoIso(2)
  },
  {
    siteId: 'demo-harbor',
    siteName: 'Harbor Health',
    siteUrl: 'https://harbor.example',
    accessibilityScore: 88,
    qaScore: 91,
    seoScore: 86,
    openA11yIssues: 7,
    openQaIssues: 4,
    openSeoIssues: 6,
    brokenLinkCount: 2,
    misspellingCount: 2,
    technicalSeoCount: 3,
    contentSeoCount: 3,
    lastScanAt: daysAgoIso(1)
  }
]

export const MARKETING_DEMO_A11Y_SCORE = 85
export const MARKETING_DEMO_OPEN_ISSUE_COUNT = MARKETING_DEMO_ISSUES.length

function fkScores(grade: number): ReadabilityScores {
  return {
    ari: null,
    coleman_liau: null,
    flesch_kincaid_grade: grade,
    flesch_reading_ease: null,
    gunning_fog: null,
    lix: null,
    smog: null
  }
}

/** Pages for the readability showcase (Flesch–Kincaid grade levels). */
export const MARKETING_DEMO_READABILITY_PAGES: ReadabilityPageRow[] = [
  { id: 'rp-1', url: 'https://acme.example/', title: 'Home', word_count: 420, scores: fkScores(7.2) },
  { id: 'rp-2', url: 'https://acme.example/services', title: 'Services', word_count: 680, scores: fkScores(8.4) },
  { id: 'rp-3', url: 'https://acme.example/about', title: 'About us', word_count: 510, scores: fkScores(9.1) },
  { id: 'rp-4', url: 'https://acme.example/research/methods', title: 'Research methods', word_count: 1240, scores: fkScores(12.6) },
  { id: 'rp-5', url: 'https://acme.example/research/findings', title: 'Findings', word_count: 980, scores: fkScores(11.2) },
  { id: 'rp-6', url: 'https://acme.example/blog/welcome', title: 'Welcome post', word_count: 310, scores: fkScores(6.5) },
  { id: 'rp-7', url: 'https://acme.example/contact', title: 'Contact', word_count: 180, scores: fkScores(5.8) },
  { id: 'rp-8', url: 'https://acme.example/legal/terms', title: 'Terms of use', word_count: 2100, scores: fkScores(14.3) },
  { id: 'rp-9', url: 'https://acme.example/careers', title: 'Careers', word_count: 540, scores: fkScores(8.0) },
  { id: 'rp-10', url: 'https://acme.example/blog/accessibility', title: 'Accessibility tips', word_count: 760, scores: fkScores(7.8) }
]

export const MARKETING_DEMO_READABILITY_METHOD = 'flesch_kincaid_grade' as const

export interface MarketingDemoCrawlLine {
  id: string
  level: CrawlLogLevel
  message: string
  url?: string
}

/** Seed + rotating lines for the live scanner showcase. */
export const MARKETING_DEMO_CRAWL_SEED: MarketingDemoCrawlLine[] = [
  { id: 'cl-1', level: 'info', message: 'Scan started' },
  { id: 'cl-2', level: 'info', message: 'Authenticated session ready' },
  { id: 'cl-3', level: 'success', message: 'Crawled page', url: 'https://acme.example/' },
  { id: 'cl-4', level: 'success', message: 'Crawled page', url: 'https://acme.example/services' },
  { id: 'cl-5', level: 'info', message: 'Running axe-core checks', url: 'https://acme.example/' },
  { id: 'cl-6', level: 'success', message: 'Crawled page', url: 'https://acme.example/about' },
  { id: 'cl-7', level: 'warn', message: 'Slow response (2.4s)', url: 'https://acme.example/research/methods' },
  { id: 'cl-8', level: 'success', message: 'Crawled page', url: 'https://acme.example/research/methods' },
  { id: 'cl-9', level: 'info', message: 'Checking broken links', url: 'https://acme.example/services' },
  { id: 'cl-10', level: 'error', message: 'Broken link → /old-brochure.pdf (404)', url: 'https://acme.example/services' }
]

export const MARKETING_DEMO_CRAWL_ROTATION: MarketingDemoCrawlLine[] = [
  { id: 'cl-r1', level: 'success', message: 'Crawled page', url: 'https://acme.example/blog/welcome' },
  { id: 'cl-r2', level: 'info', message: 'Running spell check', url: 'https://acme.example/about' },
  { id: 'cl-r3', level: 'success', message: 'Crawled page', url: 'https://acme.example/contact' },
  { id: 'cl-r4', level: 'warn', message: 'Low contrast candidates found', url: 'https://acme.example/careers' },
  { id: 'cl-r5', level: 'success', message: 'Crawled page', url: 'https://acme.example/careers' },
  { id: 'cl-r6', level: 'info', message: 'Scoring readability', url: 'https://acme.example/research/findings' },
  { id: 'cl-r7', level: 'success', message: 'Crawled page', url: 'https://acme.example/legal/terms' },
  { id: 'cl-r8', level: 'info', message: 'Indexing page for search', url: 'https://acme.example/blog/accessibility' }
]
