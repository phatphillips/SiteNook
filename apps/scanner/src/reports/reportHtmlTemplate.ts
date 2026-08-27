import type { ReportSectionData } from './types.js'
import {
  formatReportDate,
  preparePdfSections,
  type PreparedPdfSection,
  type ReportPdfOptions
} from './preparePdfSections.js'
import type { ReportExecutiveSummary } from './reportSummary.js'
import { renderReportOverviewHtml, renderOverviewUnavailableHtml } from './reportOverviewHtml.js'
import {
  buildReportTocEntries,
  dataSectionAnchorId,
  renderTableOfContentsHtml
} from './reportTableOfContents.js'
import type { ReportOverviewSectionKey } from './types.js'
import type { ReportOverviewData } from './buildReportOverviewData.js'
import {
  REPORT_COLORS,
  eyebrowForDataSection,
  eyebrowForExecutiveSummary,
  renderSectionMarker
} from './reportChrome.js'

function escapeHtml(value: string): string {
  const text = value ?? ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function severityClass(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized.includes('critical')) return 'severity-critical'
  if (normalized.includes('serious')) return 'severity-serious'
  if (normalized.includes('moderate')) return 'severity-moderate'
  if (normalized.includes('minor')) return 'severity-minor'
  return 'severity-default'
}

function severityLabel(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized.includes('critical')) return 'Critical'
  if (normalized.includes('serious')) return 'Serious'
  if (normalized.includes('moderate')) return 'Moderate'
  if (normalized.includes('minor')) return 'Minor'
  return value || '—'
}

function renderSeverityBadge(value: string): string {
  return `<span class="severity-badge ${severityClass(value)}"><span class="severity-dot" aria-hidden="true"></span>${escapeHtml(severityLabel(value))}</span>`
}

function renderCell(columnKey: string, columnLabel: string, value: string): string {
  const safe = escapeHtml(value || '—')
  if (columnKey === 'severity' || columnLabel === 'Severity') {
    return renderSeverityBadge(value)
  }
  if (columnKey === 'level' || columnLabel === 'Level') {
    return `<span class="chip">${safe}</span>`
  }
  if (columnKey === 'issue' || columnLabel === 'Issue') {
    return `<span class="issue-text">${safe}</span>`
  }
  if (columnKey.includes('url') || columnLabel.toLowerCase().includes('url') || columnLabel === 'Page') {
    return `<span class="url-text">${safe}</span>`
  }
  return safe
}

function renderDrillDown(section: PreparedPdfSection): string {
  if (!section.issueDrillDown?.length) return ''

  const blocks = section.issueDrillDown.map((item) => {
    const pages = item.pages.length
      ? item.pages.map(url => `<tr><td class="drilldown-url"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></td></tr>`).join('')
      : '<tr><td class="muted">No page URLs recorded</td></tr>'
    return `
      <table class="drilldown-table">
        <thead>
          <tr>
            <th>
              <div class="drilldown-head">
                <span class="drilldown-issue">${escapeHtml(item.title)}</span>
                ${renderSeverityBadge(item.impact)}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>${pages}</tbody>
      </table>
    `
  }).join('')

  return `
    <div class="drilldown-block">
      <h3 class="drilldown-title">Priority issue details</h3>
      <p class="section-meta">Top issues with affected page URLs from the latest completed scans.</p>
      <div class="drilldown-stack">${blocks}</div>
    </div>
  `
}

function renderSection(section: PreparedPdfSection): string {
  const summary = section.truncated
    ? `Showing ${section.rows.length} of ${section.totalRows} records — continues automatically across pages.`
    : `${section.totalRows} ${section.totalRows === 1 ? 'record' : 'records'} — continues automatically across pages.`

  const eyebrow = eyebrowForDataSection(section.key)
  const head = section.columns.map(column => {
    const align = column.align === 'center' ? 'center' : column.align === 'right' ? 'right' : 'left'
    return `<th style="width:${Math.round(column.width * 100)}%;text-align:${align}">${escapeHtml(column.label)}</th>`
  }).join('')

  const body = section.rows.length
    ? section.rows.map((row, rowIndex) => {
      const cells = section.columns.map((column, index) => {
        const align = column.align === 'center' ? 'center' : column.align === 'right' ? 'right' : 'left'
        const raw = row[index] || ''
        const content = column.key === '#' || column.label === '#'
          ? `<span class="row-index">${escapeHtml(raw || String(rowIndex + 1))}</span>`
          : renderCell(column.key, column.label, raw)
        return `<td style="text-align:${align}">${content}</td>`
      }).join('')
      return `<tr>${cells}</tr>`
    }).join('')
    : `<tr><td colspan="${section.columns.length}" class="empty">No data available for this section.</td></tr>`

  const anchorId = dataSectionAnchorId(section.key)

  const methodNote = section.metaNote ? ` ${section.metaNote}` : ''

  return `
    <section class="report-section report-flow-section" id="${escapeHtml(anchorId)}" data-report-eyebrow="${escapeHtml(eyebrow)}">
      ${renderSectionMarker(eyebrow, anchorId)}
      <div class="section-heading">
        <h2>${escapeHtml(section.label)}</h2>
        <p class="section-meta">${escapeHtml(summary)}${escapeHtml(methodNote)}</p>
      </div>
      <div class="table-surface">
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      ${renderDrillDown(section)}
    </section>
  `
}

function renderExecutiveSummary(summary: ReportExecutiveSummary): string {
  const score = summary.averageAccessibilityScore != null
    ? String(summary.averageAccessibilityScore)
    : '—'

  const topIssues = summary.topIssues.length
    ? summary.topIssues.map((issue, index) => `
        <tr>
          <td class="rank"><span class="row-index">${index + 1}</span></td>
          <td><span class="issue-text">${escapeHtml(issue.title)}</span></td>
          <td>${renderSeverityBadge(issue.impact)}</td>
          <td class="num">${issue.pages}</td>
          <td class="num">${issue.occurrences}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5" class="empty">No accessibility issues in this report.</td></tr>'

  const accentClasses = ['accent-teal', 'accent-red', 'accent-orange', 'accent-blue', 'accent-purple']
  const primaryCards = [
    { label: 'Accessibility score', value: score, accent: 'accent-teal', large: true },
    { label: 'Open issues', value: String(summary.totalOpenIssues), accent: 'accent-red' },
    { label: 'Critical / serious', value: String(summary.criticalIssueRules), accent: 'accent-orange', hint: 'rules' },
    { label: 'Sites in scope', value: String(summary.siteCount), accent: 'accent-blue' }
  ]

  const sectionCards = summary.sectionTotals.map((item, index) => `
    <article class="metric-card ${accentClasses[(index + 4) % accentClasses.length]}">
      <p class="metric-label">${escapeHtml(item.label)}</p>
      <p class="metric-value">${item.count}</p>
    </article>
  `).join('')

  const primaryHtml = primaryCards.map(card => `
    <article class="metric-card ${card.accent}">
      <p class="metric-label">${escapeHtml(card.label)}</p>
      <p class="metric-value${card.large ? ' large' : ''}">${escapeHtml(card.value)}</p>
      ${card.hint ? `<p class="metric-hint">${escapeHtml(card.hint)}</p>` : ''}
    </article>
  `).join('')

  const eyebrow = eyebrowForExecutiveSummary()

  return `
    <section class="summary-page report-flow-section" id="section-executive-summary" data-report-eyebrow="${eyebrow}">
      ${renderSectionMarker(eyebrow, 'section-executive-summary')}
      <div class="section-heading">
        <h2>Executive summary</h2>
        <p class="section-meta">Snapshot from the latest completed scans in scope.</p>
      </div>
      <div class="metric-grid">${primaryHtml}${sectionCards}</div>
      <div class="table-surface summary-table">
        <h3 class="inline-title">Top issues to address</h3>
        <table>
          <thead>
            <tr>
              <th style="width:6%">#</th>
              <th style="width:44%">Issue</th>
              <th style="width:16%">Severity</th>
              <th style="width:14%">Pages</th>
              <th style="width:20%">Occurrences</th>
            </tr>
          </thead>
          <tbody>${topIssues}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderCover(options: ReportPdfOptions, sections: PreparedPdfSection[]): string {
  const orgName = options.orgName || options.summary?.orgName || 'Your organization'
  const totalFindings = sections.reduce((sum, section) => sum + section.totalRows, 0)
  const chips = sections.map(section => `
    <li class="cover-chip">
      <span class="cover-chip-label">${escapeHtml(section.label)}</span>
      <span class="cover-chip-value">${section.totalRows.toLocaleString()}</span>
    </li>
  `).join('')

  return `
    <section class="cover-page">
      <div class="cover-hero">
        <div class="cover-brand">
          <span class="cover-mark">SiteNook</span>
          <span class="cover-org">${escapeHtml(orgName)}</span>
        </div>
        <div class="cover-body">
          <p class="cover-eyebrow">Website quality report</p>
          <h1>${escapeHtml(options.title)}</h1>
          <p class="cover-lead">
            Accessibility, QA, and SEO findings from your latest completed scans.
          </p>
          <dl class="cover-meta">
            <div>
              <dt>Scope</dt>
              <dd>${escapeHtml(options.scopeLabel)}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>${escapeHtml(formatReportDate(options.generatedAt))}</dd>
            </div>
            <div>
              <dt>Sections</dt>
              <dd>${sections.length}</dd>
            </div>
            <div>
              <dt>Findings</dt>
              <dd>${totalFindings.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
        ${chips ? `
          <div class="cover-included">
            <p class="cover-included-title">Included in this export</p>
            <ul class="cover-chip-list">${chips}</ul>
          </div>
        ` : ''}
      </div>
    </section>
  `
}

const REPORT_STYLES = `
  @page {
    size: A4 portrait;
    margin: 0;
  }

  @page overview-sheet {
    size: A4 landscape;
    margin: 0;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: "Public Sans", "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: ${REPORT_COLORS.ink};
    background: ${REPORT_COLORS.white};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .aiq-section-marker {
    display: inline;
    font-size: 8pt;
    line-height: 1;
    color: ${REPORT_COLORS.white};
  }

  .cover-page {
    height: 297mm;
    max-height: 297mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    break-after: page;
    background: linear-gradient(
      180deg,
      ${REPORT_COLORS.navy} 0%,
      ${REPORT_COLORS.navyMid} 16%,
      ${REPORT_COLORS.navyLight} 34%,
      ${REPORT_COLORS.white} 48%
    );
    color: ${REPORT_COLORS.ink};
  }

  .cover-hero {
    flex: 1;
    padding: 16mm 14mm 14mm;
  }

  .cover-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14mm;
  }

  .cover-mark {
    display: inline-flex;
    align-items: center;
    padding: 7px 14px;
    border-radius: 999px;
    background: ${REPORT_COLORS.logoPill};
    color: ${REPORT_COLORS.white};
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .cover-org {
    font-size: 14px;
    font-weight: 700;
    color: ${REPORT_COLORS.white};
  }

  .cover-eyebrow {
    margin: 0 0 10px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${REPORT_COLORS.accent};
  }

  .cover-body h1 {
    margin: 0;
    max-width: 18ch;
    font-size: 32px;
    line-height: 1.08;
    font-weight: 700;
    color: ${REPORT_COLORS.ink};
  }

  .cover-lead {
    margin: 10px 0 0;
    max-width: 54ch;
    font-size: 12px;
    color: ${REPORT_COLORS.gray};
  }

  .cover-meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
    margin: 18px 0 0;
  }

  .cover-meta > div {
    padding: 10px 12px;
    border: 1px solid ${REPORT_COLORS.border};
    border-radius: 10px;
    background: ${REPORT_COLORS.white};
  }

  .cover-meta dt {
    margin: 0 0 3px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${REPORT_COLORS.accent};
  }

  .cover-meta dd {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: ${REPORT_COLORS.ink};
  }

  .cover-included {
    margin-top: 16px;
    padding: 12px 14px;
    border: 1px solid ${REPORT_COLORS.border};
    border-radius: 10px;
    background: ${REPORT_COLORS.white};
  }

  .cover-included-title {
    margin: 0 0 10px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${REPORT_COLORS.accent};
  }

  .cover-chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .cover-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    background: ${REPORT_COLORS.navyLight};
    border: 1px solid ${REPORT_COLORS.border};
  }

  .cover-chip-label {
    font-size: 10px;
    font-weight: 600;
    color: ${REPORT_COLORS.ink};
  }

  .cover-chip-value {
    font-size: 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: ${REPORT_COLORS.navy};
  }

  .document-pages {
    padding: 18mm 12mm 14mm;
  }

  .report-method-banner {
    margin: 0 0 14px;
    padding: 10px 12px;
    border: 1px solid ${REPORT_COLORS.border};
    border-radius: 8px;
    background: ${REPORT_COLORS.navyLight};
    color: ${REPORT_COLORS.navy};
    font-size: 11px;
  }

  .report-method-banner strong {
    font-weight: 700;
  }

  .summary-page,
  .report-section,
  .toc-page {
    padding: 0 0 6mm;
  }

  .summary-page,
  .toc-page,
  .overview-page {
    page-break-after: always;
  }

  .report-section ~ .report-section {
    page-break-before: always;
  }

  .section-heading {
    margin: 0 0 14px;
  }

  .section-eyebrow {
    display: none;
  }

  .section-heading h2,
  .inline-title,
  .drilldown-title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: ${REPORT_COLORS.ink};
  }

  .inline-title {
    padding: 14px 16px 10px;
    font-size: 14px;
  }

  .section-meta {
    margin: 6px 0 0;
    color: ${REPORT_COLORS.gray};
    font-size: 11px;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7.2rem, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }

  .metric-card {
    position: relative;
    padding: 14px 14px 12px;
    border: 1px solid ${REPORT_COLORS.border};
    border-radius: 10px;
    background: ${REPORT_COLORS.white};
    overflow: hidden;
  }

  .metric-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: ${REPORT_COLORS.accent};
  }

  .metric-card.accent-teal::before { background: ${REPORT_COLORS.accent}; }
  .metric-card.accent-red::before { background: ${REPORT_COLORS.critical}; }
  .metric-card.accent-orange::before { background: ${REPORT_COLORS.serious}; }
  .metric-card.accent-blue::before { background: ${REPORT_COLORS.blue}; }
  .metric-card.accent-purple::before { background: ${REPORT_COLORS.moderate}; }

  .metric-label {
    margin: 0;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${REPORT_COLORS.gray};
  }

  .metric-value {
    margin: 8px 0 0;
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    color: ${REPORT_COLORS.ink};
  }

  .metric-value.large {
    font-size: 28px;
    color: ${REPORT_COLORS.navy};
  }

  .metric-hint {
    margin: 4px 0 0;
    font-size: 10px;
    color: ${REPORT_COLORS.softGray};
  }

  .table-surface {
    border: none;
    border-radius: 0;
    overflow: visible;
    background: ${REPORT_COLORS.white};
  }

  .summary-table {
    margin-top: 4px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1px solid ${REPORT_COLORS.border};
  }

  thead {
    display: table-header-group;
  }

  tfoot {
    display: table-footer-group;
  }

  th {
    padding: 9px 11px;
    text-align: left;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${REPORT_COLORS.ink};
    background: ${REPORT_COLORS.navyLight};
    border-bottom: 1px solid ${REPORT_COLORS.border};
    vertical-align: bottom;
  }

  td {
    padding: 9px 11px;
    border-bottom: 1px solid ${REPORT_COLORS.border};
    vertical-align: top;
    word-break: break-word;
    color: ${REPORT_COLORS.ink};
  }

  tbody tr:nth-child(even) td {
    background: ${REPORT_COLORS.zebra};
  }

  tbody tr:last-child td {
    border-bottom: 1px solid ${REPORT_COLORS.border};
  }

  tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Keep a clean closed edge when Chromium splits a table across pages. */
  thead th {
    border-top: 1px solid ${REPORT_COLORS.border};
  }

  td.rank,
  td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: ${REPORT_COLORS.gray};
  }

  .row-index {
    color: ${REPORT_COLORS.softGray};
    font-variant-numeric: tabular-nums;
  }

  .empty {
    text-align: center;
    color: ${REPORT_COLORS.gray};
    padding: 24px 12px !important;
  }

  .issue-text {
    font-weight: 600;
    color: ${REPORT_COLORS.ink};
  }

  .url-text {
    color: ${REPORT_COLORS.gray};
    font-size: 10px;
  }

  .chip {
    display: inline-block;
    min-width: 1.5rem;
    font-size: 10px;
    font-weight: 600;
    text-align: center;
    color: ${REPORT_COLORS.gray};
  }

  .severity-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 600;
    color: ${REPORT_COLORS.ink};
    white-space: nowrap;
  }

  .severity-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${REPORT_COLORS.gray};
    flex: 0 0 auto;
  }

  .severity-critical .severity-dot { background: ${REPORT_COLORS.critical}; }
  .severity-serious .severity-dot { background: ${REPORT_COLORS.serious}; }
  .severity-moderate .severity-dot { background: ${REPORT_COLORS.moderate}; }
  .severity-minor .severity-dot { background: ${REPORT_COLORS.minor}; }
  .severity-default .severity-dot { background: ${REPORT_COLORS.softGray}; }

  .drilldown-block {
    margin-top: 18px;
  }

  .drilldown-stack {
    margin-top: 12px;
  }

  .drilldown-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 4px;
  }

  .drilldown-table thead {
    display: table-header-group;
  }

  .drilldown-table th {
    background: transparent;
    color: ${REPORT_COLORS.ink};
    text-transform: none;
    letter-spacing: 0;
    font-size: 12px;
    font-weight: 700;
    padding: 12px 0 8px;
    border-bottom: 1px solid ${REPORT_COLORS.border};
  }

  .drilldown-table td {
    padding: 4px 0;
    border-bottom: none;
    background: transparent !important;
  }

  .drilldown-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .drilldown-issue {
    font-weight: 700;
  }

  .drilldown-url a {
    color: ${REPORT_COLORS.blue};
    text-decoration: none;
    font-size: 10px;
    word-break: break-all;
  }

  .muted {
    color: ${REPORT_COLORS.softGray};
  }

  .overview-page {
    page: overview-sheet;
    page-break-before: always;
    page-break-after: always;
  }

  .overview-top-grid {
    width: 100%;
    border-collapse: separate;
    border-spacing: 12px 0;
    margin: 0 0 12px;
  }

  .overview-top-grid td {
    vertical-align: top;
    padding: 0;
    border: none;
    background: transparent !important;
  }

  .overview-score-col { width: 22%; }
  .overview-trends-col { width: 48%; }
  .overview-conformance-col { width: 30%; }
  .overview-top-grid--qa .overview-score-col { width: 24%; }
  .overview-detail-wide { width: 76%; }
  .overview-top-grid--seo .overview-score-col { width: 24%; }
  .overview-top-grid--seo .overview-trends-col { width: 76%; }

  .overview-col-title {
    margin: 0 0 10px;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    color: ${REPORT_COLORS.ink};
  }

  .trend-columns {
    width: 100%;
    border-collapse: separate;
    border-spacing: 10px 0;
  }

  .trend-columns td {
    width: 50%;
    vertical-align: stretch;
    padding: 0;
    border: none;
    background: transparent !important;
  }

  .metric-trend-card {
    height: 100%;
    min-height: 170px;
    padding: 14px 14px;
    border: 1px solid ${REPORT_COLORS.border};
    border-radius: 10px;
    background: ${REPORT_COLORS.white};
  }

  .metric-trend-title {
    margin: 0;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${REPORT_COLORS.gray};
  }

  .metric-trend-value {
    margin: 8px 0 0;
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
    color: ${REPORT_COLORS.ink};
  }

  .metric-trend-subtitle {
    margin: 6px 0 12px;
    font-size: 11px;
    color: ${REPORT_COLORS.gray};
  }

  .conformance-card { min-height: 170px; }

  .conformance-rows { display: grid; gap: 10px; }
  .conformance-row { display: grid; gap: 6px; }
  .conformance-row-head { display: flex; align-items: center; gap: 8px; }
  .conformance-row-label { flex: 1; min-width: 0; font-size: 12px; color: ${REPORT_COLORS.ink}; }
  .conformance-row-score { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .conformance-row-track {
    height: 8px;
    border-radius: 999px;
    background: ${REPORT_COLORS.navyLight};
    overflow: hidden;
  }
  .conformance-row-fill { height: 100%; border-radius: 999px; }

  .site-target-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.75rem;
    height: 1.25rem;
    padding: 0 6px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
    color: ${REPORT_COLORS.white};
  }

  .site-target-badge--a { background: ${REPORT_COLORS.critical}; }
  .site-target-badge--aa { background: ${REPORT_COLORS.moderate}; }
  .site-target-badge--aaa { background: ${REPORT_COLORS.blue}; }
  .site-target-badge--aria { background: ${REPORT_COLORS.blue}; }
  .site-target-badge--bp { background: ${REPORT_COLORS.navy}; }

  .metric-card-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 10px;
  }

  .metric-card-table td {
    vertical-align: top;
    padding: 0;
    border: none;
    background: transparent !important;
  }

  .metric-card-table--cols-2 td { width: 50%; }
  .metric-card-table--cols-3 td { width: 33.33%; }
  .metric-card-table--cols-4 td { width: 25%; }

  .overview-chart-panel {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 8px 0;
  }

  .overview-detail-panel .inline-title,
  .overview-block .inline-title,
  .panel-card .inline-title {
    padding-left: 0;
    padding-top: 0;
  }

  .overview-block { margin-top: 16px; }
  .overview-block .inline-title { margin-bottom: 10px; }

  .chart-svg {
    display: block;
    max-width: 100%;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .chart-bar-list { display: grid; gap: 10px; }
  .chart-bar-row {
    display: grid;
    grid-template-columns: 4.5rem 1fr 2.5rem;
    gap: 10px;
    align-items: center;
  }
  .chart-bar-label { font-size: 11px; color: ${REPORT_COLORS.gray}; text-align: right; }
  .chart-bar-track {
    height: 10px;
    border-radius: 999px;
    background: ${REPORT_COLORS.navyLight};
    overflow: hidden;
  }
  .chart-bar-fill { height: 100%; border-radius: 999px; }
  .chart-bar-value {
    font-size: 11px;
    font-weight: 600;
    color: ${REPORT_COLORS.ink};
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .metric-card-good .metric-value { color: ${REPORT_COLORS.accent}; }
  .metric-card-warn .metric-value { color: ${REPORT_COLORS.serious}; }
  .metric-card-bad .metric-value { color: ${REPORT_COLORS.critical}; }
  .metric-card-critical .metric-value { color: ${REPORT_COLORS.critical}; }
  .metric-card-serious .metric-value { color: ${REPORT_COLORS.serious}; }
  .metric-card-moderate .metric-value { color: ${REPORT_COLORS.moderate}; }
  .metric-card-minor .metric-value { color: ${REPORT_COLORS.minor}; }

  .donut-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .donut-label {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    color: ${REPORT_COLORS.gray};
    text-align: center;
  }

  .donut-caption {
    margin: 8px 0 0;
    font-size: 12px;
    font-weight: 600;
    color: ${REPORT_COLORS.navy};
    text-align: center;
  }

  .panel-card {
    padding: 14px 16px;
    border: 1px solid ${REPORT_COLORS.border};
    border-radius: 10px;
    background: ${REPORT_COLORS.white};
  }

  .panel-card .inline-title { margin-bottom: 12px; }

  .toc-page {
    page-break-after: always;
  }

  .toc-list {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
  }

  .toc-row {
    display: grid;
    grid-template-columns: 3.2rem minmax(0, 1fr);
    gap: 10px;
    padding: 14px 0;
    border-bottom: 1px solid ${REPORT_COLORS.border};
  }

  .toc-index {
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
    color: ${REPORT_COLORS.border};
  }

  .toc-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .toc-link {
    color: ${REPORT_COLORS.ink};
    text-decoration: none;
    font-size: 14px;
    font-weight: 700;
  }

  .toc-link:hover {
    color: ${REPORT_COLORS.accent};
  }

  .toc-page-num {
    font-size: 13px;
    font-weight: 700;
    color: ${REPORT_COLORS.accent};
    font-variant-numeric: tabular-nums;
    min-width: 1.5rem;
    text-align: right;
  }

  .toc-page-num a,
  .toc-page-link {
    color: inherit;
    text-decoration: none !important;
    border-bottom: none !important;
  }

  .toc-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: ${REPORT_COLORS.navyLight};
    color: ${REPORT_COLORS.navy};
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .toc-desc-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin-top: 4px;
  }

  .toc-desc {
    margin: 0;
    font-size: 11px;
    color: ${REPORT_COLORS.gray};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .overview-table {
    margin-top: 16px;
  }
`

function resolveOverviewSections(
  overviewSections: ReportOverviewSectionKey[] | undefined,
  overviewData: ReportOverviewData | undefined
): ReportOverviewSectionKey[] {
  if (overviewSections?.length) return overviewSections
  if (!overviewData) return []
  const keys: ReportOverviewSectionKey[] = []
  if (overviewData.accessibility) keys.push('overview.accessibility')
  if (overviewData.qa) keys.push('overview.qa')
  if (overviewData.seo) keys.push('overview.seo')
  if (overviewData.orgSummary) keys.push('overview.orgSummary')
  return keys
}

export function buildReportHtml(sections: ReportSectionData[], options: ReportPdfOptions): string {
  const prepared = preparePdfSections(sections, {
    readabilityMethodId: options.readabilityMethodId,
    readabilityMethodLabel: options.readabilityMethodLabel
  })
  const generatedAt = options.generatedAt || new Date().toISOString()
  const summaryHtml = options.summary ? renderExecutiveSummary(options.summary) : ''
  const overviewSectionKeys = resolveOverviewSections(options.overviewSections, options.overviewData)
  const overviewHtml = overviewSectionKeys.length && options.overviewData
    ? renderReportOverviewHtml(overviewSectionKeys, options.overviewData)
    : overviewSectionKeys.length
      ? renderOverviewUnavailableHtml(overviewSectionKeys)
      : ''

  const tocHtml = options.includeTableOfContents
    ? renderTableOfContentsHtml(buildReportTocEntries({
      includeExecutiveSummary: !!options.summary,
      overviewSections: overviewSectionKeys,
      dataSections: prepared.map(section => section.key),
      sectionPageNumbers: options.sectionPageNumbers
    }))
    : ''

  const readabilityBanner = options.readabilityMethodLabel
    && prepared.some(section => section.key === 'accessibility.readability')
    ? `<p class="report-method-banner">Readability method: <strong>${escapeHtml(options.readabilityMethodLabel)}</strong></p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
  ${renderCover({ ...options, generatedAt }, prepared)}
  <div class="document-pages">
    ${tocHtml}
    ${summaryHtml}
    ${overviewHtml}
    ${readabilityBanner}
    ${prepared.map(renderSection).join('\n')}
  </div>
</body>
</html>`
}
