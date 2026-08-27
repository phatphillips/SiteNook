import type { ReportDataSectionKey, ReportOverviewSectionKey } from './types.js'
import { REPORT_DATA_SECTION_LABELS, REPORT_OVERVIEW_SECTION_LABELS } from './types.js'
import { overviewSectionAnchorId } from './reportOverviewHtml.js'
import {
  eyebrowForToc,
  renderSectionMarker,
  tocDescriptionForSectionId
} from './reportChrome.js'

export interface TocEntry {
  id: string
  label: string
  group: string
  description: string
  pageNumber?: number
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function dataSectionAnchorId(key: ReportDataSectionKey): string {
  return `section-${key.replace(/\./g, '-')}`
}

export function buildReportTocEntries(input: {
  includeExecutiveSummary: boolean
  overviewSections: ReportOverviewSectionKey[]
  dataSections: ReportDataSectionKey[]
  sectionPageNumbers?: Record<string, number>
}): TocEntry[] {
  const entries: TocEntry[] = []
  const pages = input.sectionPageNumbers || {}

  if (input.includeExecutiveSummary) {
    const id = 'section-executive-summary'
    entries.push({
      id,
      label: 'Executive summary',
      group: 'Summary',
      description: tocDescriptionForSectionId(id),
      pageNumber: pages[id]
    })
  }
  for (const key of input.overviewSections) {
    const id = overviewSectionAnchorId(key)
    entries.push({
      id,
      label: REPORT_OVERVIEW_SECTION_LABELS[key],
      group: 'Overview',
      description: tocDescriptionForSectionId(id),
      pageNumber: pages[id]
    })
  }
  for (const key of input.dataSections) {
    const id = dataSectionAnchorId(key)
    entries.push({
      id,
      label: REPORT_DATA_SECTION_LABELS[key],
      group: 'Detail',
      description: tocDescriptionForSectionId(id),
      pageNumber: pages[id]
    })
  }
  return entries
}

export function renderTableOfContentsHtml(entries: TocEntry[]): string {
  if (!entries.length) return ''

  const rows = entries.map((entry, index) => {
    const num = String(index + 1).padStart(2, '0')
    const pageLabel = entry.pageNumber != null ? String(entry.pageNumber) : '—'
    const href = `#${escapeHtml(entry.id)}`
    return `
      <li class="toc-row">
        <div class="toc-index" aria-hidden="true">${num}</div>
        <div class="toc-body">
          <div class="toc-title-row">
            <a class="toc-link" href="${href}">${escapeHtml(entry.label)}</a>
            <span class="toc-badge">${escapeHtml(entry.group)}</span>
          </div>
          <div class="toc-desc-row">
            <p class="toc-desc">${escapeHtml(entry.description)}</p>
            <span class="toc-page-num"><a class="toc-page-link" href="${href}">${escapeHtml(pageLabel)}</a></span>
          </div>
        </div>
      </li>
    `
  }).join('')

  return `
    <section class="toc-page report-flow-section" id="section-table-of-contents" data-report-eyebrow="${eyebrowForToc()}">
      ${renderSectionMarker(eyebrowForToc(), 'section-table-of-contents')}
      <div class="section-heading">
        <h2>Table of contents</h2>
        <p class="section-meta">Jump to a section in this report.</p>
      </div>
      <ol class="toc-list">${rows}</ol>
    </section>
  `
}
