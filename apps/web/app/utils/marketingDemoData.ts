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

/**
 * Synthetic 30-day history: score climbs, open issues fall.
 * Level A stays ahead; AA is the compliance bottleneck users care about.
 */
export const MARKETING_DEMO_SCANS: Scan[] = [
  { id: 'demo-scan-29', site: DEMO_SITE_ID, status: 'complete', scan_type: 'full', pages_crawled: 42, completed_at: daysAgoIso(28), score_a: 78, score_aa: 61, score_aaa: 48, score_best_practices: 55, score_overall: 64, score_qa: 58, score_seo: 55, open_issue_count: 86 },
  { id: 'demo-scan-22', site: DEMO_SITE_ID, status: 'complete', scan_type: 'full', pages_crawled: 47, completed_at: daysAgoIso(21), score_a: 84, score_aa: 66, score_aaa: 52, score_best_practices: 60, score_overall: 69, score_qa: 64, score_seo: 61, open_issue_count: 61 },
  { id: 'demo-scan-15', site: DEMO_SITE_ID, status: 'complete', scan_type: 'full', pages_crawled: 51, completed_at: daysAgoIso(14), score_a: 89, score_aa: 71, score_aaa: 56, score_best_practices: 64, score_overall: 74, score_qa: 70, score_seo: 67, open_issue_count: 39 },
  { id: 'demo-scan-8', site: DEMO_SITE_ID, status: 'complete', scan_type: 'full', pages_crawled: 55, completed_at: daysAgoIso(7), score_a: 93, score_aa: 76, score_aaa: 59, score_best_practices: 68, score_overall: 79, score_qa: 75, score_seo: 72, open_issue_count: 22 },
  { id: DEMO_SCAN_ID, site: DEMO_SITE_ID, status: 'complete', scan_type: 'full', pages_crawled: 58, completed_at: daysAgoIso(1), score_a: 96, score_aa: 81, score_aaa: 63, score_best_practices: 72, score_overall: 84, score_qa: 80, score_seo: 76, score_seo_technical: 79, score_seo_content: 72, open_issue_count: 12 }
]

/** Pages-with-issues counts per demo scan (also trending down). */
export const MARKETING_DEMO_PAGES_WITH_ISSUES_BY_SCAN = new Map<string, number>([
  ['demo-scan-29', 38],
  ['demo-scan-22', 29],
  ['demo-scan-15', 21],
  ['demo-scan-8', 14],
  [DEMO_SCAN_ID, 8]
])

/** Live conformance panel numbers for marketing / screenshot fixtures. */
export const MARKETING_DEMO_CATEGORY_SCORES = {
  levelA: 96,
  levelAA: 81,
  levelAAA: 63,
  aria: 88,
  bestPractice: 72
} as const

export const MARKETING_DEMO_ISSUES: AccessibilityIssue[] = [
  {
    id: 'demo-issue-1',
    scan: DEMO_SCAN_ID,
    page: 'demo-page-1',
    rule_id: 'color-contrast',
    wcag_level: 'AA',
    wcag_sc: '1.4.3',
    impact: 'serious',
    type: 'error',
    description: 'Elements must meet minimum color contrast ratio thresholds',
    status: 'open',
    expand: { page: { url: 'https://acme.example/services', title: 'Services' } }
  },
  {
    id: 'demo-issue-2',
    scan: DEMO_SCAN_ID,
    page: 'demo-page-2',
    rule_id: 'image-alt',
    wcag_level: 'A',
    wcag_sc: '1.1.1',
    impact: 'critical',
    type: 'error',
    description: 'Images must have alternate text',
    status: 'open',
    expand: { page: { url: 'https://acme.example/', title: 'Home' } }
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
    expand: { page: { url: 'https://acme.example/contact', title: 'Contact' } }
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
    expand: { page: { url: 'https://acme.example/blog', title: 'Blog' } }
  },
  {
    id: 'demo-issue-5',
    scan: DEMO_SCAN_ID,
    page: 'demo-page-5',
    rule_id: 'button-name',
    wcag_level: 'A',
    wcag_sc: '4.1.2',
    impact: 'critical',
    type: 'error',
    description: 'Buttons must have discernible text',
    status: 'open',
    expand: { page: { url: 'https://acme.example/careers', title: 'Careers' } }
  },
  {
    id: 'demo-issue-6',
    scan: DEMO_SCAN_ID,
    page: 'demo-page-6',
    rule_id: 'heading-order',
    wcag_level: 'AA',
    wcag_sc: '1.3.1',
    impact: 'moderate',
    type: 'warning',
    description: 'Heading levels should only increase by one',
    status: 'open',
    expand: { page: { url: 'https://acme.example/about', title: 'About' } }
  }
]

export const MARKETING_DEMO_POINTS_TO_GAIN = new Map<string, number>([
  ['color-contrast', 5.4],
  ['image-alt', 3.8],
  ['label', 2.9],
  ['button-name', 2.1],
  ['link-name', 1.4],
  ['heading-order', 0.7]
])

export const MARKETING_DEMO_PAGES_BY_RULE = new Map<string, string[]>([
  ['color-contrast', ['https://acme.example/services', 'https://acme.example/contact', 'https://acme.example/careers']],
  ['image-alt', ['https://acme.example/', 'https://acme.example/services', 'https://acme.example/blog']],
  ['label', ['https://acme.example/contact', 'https://acme.example/careers']],
  ['button-name', ['https://acme.example/careers']],
  ['link-name', ['https://acme.example/blog', 'https://acme.example/about']],
  ['heading-order', ['https://acme.example/about']]
])

export const MARKETING_DEMO_ATTENTION_SITES: SiteDashboardSnapshot[] = [
  {
    siteId: 'demo-acme',
    siteName: 'Acme Research',
    siteUrl: 'https://acme.example',
    accessibilityScore: 64,
    qaScore: 58,
    seoScore: 61,
    openA11yIssues: 86,
    openQaIssues: 41,
    openSeoIssues: 27,
    brokenLinkCount: 22,
    misspellingCount: 17,
    technicalSeoCount: 16,
    contentSeoCount: 11,
    lastScanAt: daysAgoIso(1)
  },
  {
    siteId: 'demo-northwind',
    siteName: 'Northwind Docs',
    siteUrl: 'https://docs.northwind.example',
    accessibilityScore: 79,
    qaScore: 74,
    seoScore: 78,
    openA11yIssues: 22,
    openQaIssues: 14,
    openSeoIssues: 11,
    brokenLinkCount: 8,
    misspellingCount: 6,
    technicalSeoCount: 7,
    contentSeoCount: 4,
    lastScanAt: daysAgoIso(2)
  },
  {
    siteId: 'demo-harbor',
    siteName: 'Harbor Health',
    siteUrl: 'https://harbor.example',
    accessibilityScore: 91,
    qaScore: 88,
    seoScore: 86,
    openA11yIssues: 6,
    openQaIssues: 5,
    openSeoIssues: 7,
    brokenLinkCount: 2,
    misspellingCount: 2,
    technicalSeoCount: 3,
    contentSeoCount: 4,
    lastScanAt: daysAgoIso(1)
  }
]

export const MARKETING_DEMO_A11Y_SCORE = 84
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
