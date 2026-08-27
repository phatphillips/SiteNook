import type { ReportSectionSelection } from './types.js'

export function normalizeReportSectionSelection(
  sections?: ReportSectionSelection | null
): ReportSectionSelection {
  return {
    options: {
      tableOfContents: sections?.options?.tableOfContents === true
    },
    overview: {
      accessibility: sections?.overview?.accessibility === true,
      qa: sections?.overview?.qa === true,
      seo: sections?.overview?.seo === true,
      orgSummary: sections?.overview?.orgSummary === true
    },
    accessibility: {
      pages: sections?.accessibility?.pages === true,
      issues: sections?.accessibility?.issues === true,
      readability: sections?.accessibility?.readability === true,
      pdfs: sections?.accessibility?.pdfs === true
    },
    qa: {
      brokenLinks: sections?.qa?.brokenLinks === true,
      spelling: sections?.qa?.spelling === true,
      inventory: sections?.qa?.inventory === true
    },
    seo: {
      technical: sections?.seo?.technical === true,
      content: sections?.seo?.content === true,
      preview: false
    }
  }
}
