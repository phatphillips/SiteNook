import type { ReportOverviewSectionSelection, ReportSectionSelection } from '~/types/reports'

export const REPORT_OVERVIEW_SECTION_LABELS: Record<keyof ReportOverviewSectionSelection, string> = {
  accessibility: 'Accessibility overview',
  qa: 'QA overview',
  seo: 'SEO overview',
  orgSummary: 'All-sites summary'
}

export function defaultReportSectionSelection(): ReportSectionSelection {
  return {
    options: {
      tableOfContents: true
    },
    overview: {
      accessibility: true,
      qa: false,
      seo: false,
      orgSummary: false
    },
    accessibility: { pages: false, issues: true, readability: false, pdfs: false },
    qa: { brokenLinks: false, spelling: false, inventory: false },
    seo: { technical: false, content: false, preview: false }
  }
}

/** Backfill overview flags for jobs created before Phase 2. */
export function normalizeReportSectionSelection(
  sections?: Partial<ReportSectionSelection> | null
): ReportSectionSelection {
  const defaults = defaultReportSectionSelection()
  if (!sections) return defaults

  return {
    options: {
      tableOfContents: sections.options?.tableOfContents ?? defaults.options!.tableOfContents
    },
    overview: {
      accessibility: sections.overview?.accessibility ?? defaults.overview.accessibility,
      qa: sections.overview?.qa ?? defaults.overview.qa,
      seo: sections.overview?.seo ?? defaults.overview.seo,
      orgSummary: sections.overview?.orgSummary ?? defaults.overview.orgSummary
    },
    accessibility: {
      pages: sections.accessibility?.pages ?? defaults.accessibility.pages,
      issues: sections.accessibility?.issues ?? defaults.accessibility.issues,
      readability: sections.accessibility?.readability ?? defaults.accessibility.readability,
      pdfs: sections.accessibility?.pdfs ?? defaults.accessibility.pdfs
    },
    qa: {
      brokenLinks: sections.qa?.brokenLinks ?? defaults.qa.brokenLinks,
      spelling: sections.qa?.spelling ?? defaults.qa.spelling,
      inventory: sections.qa?.inventory ?? defaults.qa.inventory
    },
    seo: {
      technical: sections.seo?.technical ?? defaults.seo.technical,
      content: sections.seo?.content ?? defaults.seo.content,
      preview: false
    }
  }
}

export function countSelectedOverviewSections(sections?: ReportSectionSelection): number {
  if (!sections?.overview) return 0
  return [
    sections.overview.accessibility,
    sections.overview.qa,
    sections.overview.seo,
    sections.overview.orgSummary
  ].filter(Boolean).length
}

export function countSelectedDataSections(sections?: ReportSectionSelection): number {
  if (!sections) return 0
  return [
    sections.accessibility?.pages,
    sections.accessibility?.issues,
    sections.accessibility?.readability,
    sections.accessibility?.pdfs,
    sections.qa?.brokenLinks,
    sections.qa?.spelling,
    sections.qa?.inventory,
    sections.seo?.technical,
    sections.seo?.content
  ].filter(Boolean).length
}

export function countSelectedReportSections(sections?: ReportSectionSelection): number {
  return countSelectedOverviewSections(sections) + countSelectedDataSections(sections)
}

export function hasSelectedReportSections(sections?: ReportSectionSelection): boolean {
  return countSelectedReportSections(sections) > 0
}

export function hasSelectedOverviewSections(sections?: ReportSectionSelection): boolean {
  return countSelectedOverviewSections(sections) > 0
}

export function hasSelectedDataSections(sections?: ReportSectionSelection): boolean {
  return countSelectedDataSections(sections) > 0
}

/** Overview charts are PDF-only; CSV exports need at least one data section. */
export function canSubmitReportSections(
  sections: ReportSectionSelection | undefined,
  format: 'pdf' | 'csv'
): boolean {
  if (!hasSelectedReportSections(sections)) return false
  if (format === 'csv') return hasSelectedDataSections(sections)
  return true
}

const DATA_SECTION_LABELS: Array<{ path: string[], label: string }> = [
  { path: ['overview', 'accessibility'], label: REPORT_OVERVIEW_SECTION_LABELS.accessibility },
  { path: ['overview', 'qa'], label: REPORT_OVERVIEW_SECTION_LABELS.qa },
  { path: ['overview', 'seo'], label: REPORT_OVERVIEW_SECTION_LABELS.seo },
  { path: ['overview', 'orgSummary'], label: REPORT_OVERVIEW_SECTION_LABELS.orgSummary },
  { path: ['accessibility', 'pages'], label: 'Accessibility pages' },
  { path: ['accessibility', 'issues'], label: 'Accessibility issues' },
  { path: ['accessibility', 'readability'], label: 'Readability' },
  { path: ['accessibility', 'pdfs'], label: 'PDF accessibility' },
  { path: ['qa', 'brokenLinks'], label: 'Broken links' },
  { path: ['qa', 'spelling'], label: 'Spelling' },
  { path: ['qa', 'inventory'], label: 'Inventory' },
  { path: ['seo', 'technical'], label: 'SEO technical' },
  { path: ['seo', 'content'], label: 'SEO content' }
]

function readSectionFlag(sections: ReportSectionSelection, path: string[]): boolean {
  let cursor: unknown = sections
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object') return false
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return cursor === true
}

export function listSelectedReportSectionLabels(
  sections?: ReportSectionSelection | null
): string[] {
  const normalized = normalizeReportSectionSelection(sections)
  const labels = DATA_SECTION_LABELS
    .filter(item => readSectionFlag(normalized, item.path))
    .map(item => item.label)
  if (normalized.options?.tableOfContents) {
    labels.unshift('Table of contents')
  }
  return labels
}
