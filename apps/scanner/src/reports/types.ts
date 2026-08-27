export type ReportFormat = 'pdf' | 'csv'

export type ReportDataSectionKey =
  | 'accessibility.pages'
  | 'accessibility.issues'
  | 'accessibility.readability'
  | 'accessibility.pdfs'
  | 'qa.links'
  | 'qa.spelling'
  | 'qa.inventory'
  | 'seo.technical'
  | 'seo.content'

export type ReportOverviewSectionKey =
  | 'overview.accessibility'
  | 'overview.qa'
  | 'overview.seo'
  | 'overview.orgSummary'

export type ReportSectionKey = ReportDataSectionKey | ReportOverviewSectionKey

export interface ReportOverviewSectionSelection {
  accessibility?: boolean
  qa?: boolean
  seo?: boolean
  orgSummary?: boolean
}

export interface ReportSectionSelection {
  options?: {
    tableOfContents?: boolean
  }
  overview?: ReportOverviewSectionSelection
  accessibility?: {
    pages?: boolean
    issues?: boolean
    readability?: boolean
    pdfs?: boolean
  }
  qa?: {
    brokenLinks?: boolean
    spelling?: boolean
    inventory?: boolean
  }
  seo?: {
    technical?: boolean
    content?: boolean
    preview?: boolean
  }
}

export interface ReportJobRecord {
  id: string
  org: string
  site?: string
  schedule?: string
  share_token?: string
  share_expires_at?: string
  format: ReportFormat
  sections?: ReportSectionSelection
  include_all_sites?: boolean
}

export interface ReportSectionData {
  key: ReportDataSectionKey
  label: string
  headers: string[]
  rows: string[][]
}

export const REPORT_DATA_SECTION_LABELS: Record<ReportDataSectionKey, string> = {
  'accessibility.pages': 'Accessibility Pages',
  'accessibility.issues': 'Accessibility Issues',
  'accessibility.readability': 'Accessibility Readability',
  'accessibility.pdfs': 'Accessibility PDFs',
  'qa.links': 'QA Broken Links',
  'qa.spelling': 'QA Spelling',
  'qa.inventory': 'QA Inventory',
  'seo.technical': 'SEO Technical',
  'seo.content': 'SEO Content'
}

export const REPORT_OVERVIEW_SECTION_LABELS: Record<ReportOverviewSectionKey, string> = {
  'overview.accessibility': 'Accessibility Overview',
  'overview.qa': 'QA Overview',
  'overview.seo': 'SEO Overview',
  'overview.orgSummary': 'All Sites Summary'
}

export const REPORT_SECTION_LABELS: Record<ReportSectionKey, string> = {
  ...REPORT_DATA_SECTION_LABELS,
  ...REPORT_OVERVIEW_SECTION_LABELS
}

export function selectedDataSections(input?: ReportSectionSelection): ReportDataSectionKey[] {
  if (!input) return []
  const keys: ReportDataSectionKey[] = []
  if (input.accessibility?.pages) keys.push('accessibility.pages')
  if (input.accessibility?.issues) keys.push('accessibility.issues')
  if (input.accessibility?.readability) keys.push('accessibility.readability')
  if (input.accessibility?.pdfs) keys.push('accessibility.pdfs')
  if (input.qa?.brokenLinks) keys.push('qa.links')
  if (input.qa?.spelling) keys.push('qa.spelling')
  if (input.qa?.inventory) keys.push('qa.inventory')
  if (input.seo?.technical) keys.push('seo.technical')
  if (input.seo?.content) keys.push('seo.content')
  return keys
}

export function selectedOverviewSections(input?: ReportSectionSelection): ReportOverviewSectionKey[] {
  if (!input?.overview) return []
  const keys: ReportOverviewSectionKey[] = []
  if (input.overview.accessibility) keys.push('overview.accessibility')
  if (input.overview.qa) keys.push('overview.qa')
  if (input.overview.seo) keys.push('overview.seo')
  if (input.overview.orgSummary) keys.push('overview.orgSummary')
  return keys
}

export function selectedSections(input?: ReportSectionSelection): ReportSectionKey[] {
  return [...selectedOverviewSections(input), ...selectedDataSections(input)]
}

export function hasAnySelectedSections(input?: ReportSectionSelection): boolean {
  return selectedSections(input).length > 0
}

export function sectionFilename(section: ReportDataSectionKey): string {
  return `${section.replace(/\./g, '-')}.csv`
}

export interface ReportSiteContext {
  siteId: string
  siteName: string
  siteUrl: string
  latestScanId?: string
  latestScanAt?: string
}

export interface ReportDataBundle {
  sites: ReportSiteContext[]
  accessibilityPages: Array<Record<string, unknown>>
  accessibilityIssues: Array<Record<string, unknown>>
  readabilityPages: Array<Record<string, unknown>>
  pdfDocuments: Array<Record<string, unknown>>
  qaBrokenLinks: Array<Record<string, unknown>>
  qaSpelling: Array<Record<string, unknown>>
  qaInventory: Array<Record<string, unknown>>
  seoIssues: Array<Record<string, unknown>>
}
