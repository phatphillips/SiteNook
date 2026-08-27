import type { ReportOverviewSectionKey } from './types.js'
import type { ReportOverviewData } from './buildReportOverviewData.js'
import {
  countTone,
  formatScoreLabel,
  impactTone,
  renderConformanceRows,
  renderMetricCards,
  renderMetricTrendCard,
  renderScoreDonutSvg
} from './reportChartSvg.js'
import { eyebrowForOverviewSection } from './reportChrome.js'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function overviewSectionAnchorId(key: ReportOverviewSectionKey): string {
  return `section-${key.replace(/\./g, '-')}`
}

function renderOverviewShell(
  title: string,
  subtitle: string,
  body: string,
  anchorId: string,
  eyebrow: string
): string {
  const marker = `<span class="aiq-section-marker" data-section-id="${escapeHtml(anchorId)}" data-eyebrow="${escapeHtml(eyebrow)}" aria-hidden="true">%%AIQSEC:${escapeHtml(eyebrow)}|${escapeHtml(anchorId)}%%</span>`
  return `
    <section class="overview-page report-section report-flow-section" id="${escapeHtml(anchorId)}" data-report-eyebrow="${escapeHtml(eyebrow)}">
      ${marker}
      <div class="section-heading">
        <h2>${escapeHtml(title)}</h2>
        <p class="section-meta">${escapeHtml(subtitle)}</p>
      </div>
      ${body}
    </section>
  `
}


function renderAccessibilityOverview(data: ReportOverviewData): string {
  const section = data.accessibility
  if (!section) return ''

  const donut = renderScoreDonutSvg(
    section.score,
    data.isAllSites ? 'Average accessibility score' : 'Site target score',
    { size: 150 }
  )
  const openIssuesLabel = `${section.openIssues.toLocaleString()} open issue${section.openIssues === 1 ? '' : 's'}`

  const conformanceRows = renderConformanceRows([
    { badge: 'A', badgeClass: 'site-target-badge--a', label: 'Level A', score: section.levelA },
    { badge: 'AA', badgeClass: 'site-target-badge--aa', label: 'Level AA', score: section.levelAA },
    { badge: 'AAA', badgeClass: 'site-target-badge--aaa', label: 'Level AAA', score: section.levelAAA },
    {
      badge: 'S',
      badgeClass: 'site-target-badge--bp',
      label: 'Accessibility best practices',
      score: section.bestPractices
    }
  ])

  const scoreTrend = renderMetricTrendCard({
    title: 'Score trend',
    subtitle: 'Overall accessibility score',
    points: section.trend,
    valueSuffix: '%',
    yMin: 0,
    yMax: 100
  })
  const issuesTrend = renderMetricTrendCard({
    title: 'Open issues',
    subtitle: 'Open accessibility issues',
    points: section.issuesTrend,
    yMin: 0,
    formatValue: value => String(Math.round(value))
  })

  const impactCards = renderMetricCards([
    { label: 'Critical', value: String(section.impactCounts.critical ?? 0), tone: impactTone('critical') },
    { label: 'Serious', value: String(section.impactCounts.serious ?? 0), tone: impactTone('serious') },
    { label: 'Moderate', value: String(section.impactCounts.moderate ?? 0), tone: impactTone('moderate') },
    { label: 'Minor', value: String(section.impactCounts.minor ?? 0), tone: impactTone('minor') }
  ])

  const body = `
    <table class="overview-top-grid" role="presentation">
      <tr>
        <td class="overview-score-col">
          <p class="overview-col-title">Site target score</p>
          ${donut}
          <p class="donut-caption">${escapeHtml(openIssuesLabel)}</p>
        </td>
        <td class="overview-trends-col">
          <table class="trend-columns" role="presentation">
            <tr>
              <td>${scoreTrend}</td>
              <td>${issuesTrend}</td>
            </tr>
          </table>
        </td>
        <td class="overview-conformance-col">
          <div class="panel-card conformance-card">
            <h3 class="inline-title">Conformance levels</h3>
            ${conformanceRows}
          </div>
        </td>
      </tr>
    </table>
    <div class="overview-block">
      <h3 class="inline-title">Open issues by severity</h3>
      ${impactCards}
    </div>
  `

  return renderOverviewShell(
    'Accessibility overview',
    `Dashboard snapshot for ${data.scopeLabel}`,
    body,
    overviewSectionAnchorId('overview.accessibility'),
    eyebrowForOverviewSection('overview.accessibility')
  )
}

function renderQaOverview(data: ReportOverviewData): string {
  const section = data.qa
  if (!section) return ''

  const donut = renderScoreDonutSvg(
    section.score,
    data.isAllSites ? 'Average QA score' : 'QA score',
    { size: 150 }
  )
  const cards = renderMetricCards([
    { label: 'Broken links', value: String(section.brokenLinks), tone: countTone(section.brokenLinks) },
    { label: 'Misspellings', value: String(section.misspellings), tone: countTone(section.misspellings) },
    { label: 'Policy matches', value: String(section.policies), tone: countTone(section.policies) },
    {
      label: 'Avg readability',
      value: section.avgReadability == null ? '—' : String(section.avgReadability),
      tone: 'neutral'
    }
  ])

  const body = `
    <table class="overview-top-grid overview-top-grid--qa" role="presentation">
      <tr>
        <td class="overview-score-col">
          <p class="overview-col-title">QA score</p>
          ${donut}
        </td>
        <td class="overview-detail-wide">
          <div class="panel-card">
            <h3 class="inline-title">Quality checks</h3>
            ${cards}
          </div>
        </td>
      </tr>
    </table>
  `

  return renderOverviewShell(
    'Quality assurance overview',
    `QA findings from the latest completed scans in ${data.scopeLabel}`,
    body,
    overviewSectionAnchorId('overview.qa'),
    eyebrowForOverviewSection('overview.qa')
  )
}

function renderSeoOverview(data: ReportOverviewData): string {
  const section = data.seo
  if (!section) return ''

  const donut = renderScoreDonutSvg(
    section.score,
    data.isAllSites ? 'Average SEO score' : 'SEO score',
    { size: 150 }
  )
  const subscores = renderMetricCards([
    { label: 'Technical', value: formatScoreLabel(section.technicalScore), tone: 'neutral' },
    { label: 'Content', value: formatScoreLabel(section.contentScore), tone: 'neutral' },
    { label: 'Crawlability', value: formatScoreLabel(section.crawlabilityScore), tone: 'neutral' },
    { label: 'Open technical issues', value: String(section.technicalIssues), tone: countTone(section.technicalIssues) }
  ], { columns: 4 })
  const seoTrend = renderMetricTrendCard({
    title: 'SEO score trend',
    subtitle: 'Overall SEO score',
    points: section.seoTrend,
    valueSuffix: '%',
    yMin: 0,
    yMax: 100
  })
  const crawlTrend = renderMetricTrendCard({
    title: 'Crawlability trend',
    subtitle: 'Crawlability score',
    points: section.crawlabilityTrend,
    valueSuffix: '%',
    yMin: 0,
    yMax: 100
  })

  const body = `
    <table class="overview-top-grid overview-top-grid--seo" role="presentation">
      <tr>
        <td class="overview-score-col">
          <p class="overview-col-title">SEO score</p>
          ${donut}
          <p class="section-meta" style="text-align:center;margin-top:8px;">
            ${section.contentIssues} open content issue${section.contentIssues === 1 ? '' : 's'}
          </p>
        </td>
        <td class="overview-trends-col">
          <table class="trend-columns" role="presentation">
            <tr>
              <td>${seoTrend}</td>
              <td>${crawlTrend}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <div class="overview-block">
      <h3 class="inline-title">SEO subscores</h3>
      ${subscores}
    </div>
  `

  return renderOverviewShell(
    'SEO overview',
    `Search performance snapshot for ${data.scopeLabel}`,
    body,
    overviewSectionAnchorId('overview.seo'),
    eyebrowForOverviewSection('overview.seo')
  )
}

function renderOrgSummary(data: ReportOverviewData): string {
  const section = data.orgSummary
  if (!section) return ''

  const summaryCards = renderMetricCards([
    { label: 'Avg accessibility', value: formatScoreLabel(section.avgAccessibility), tone: 'neutral' },
    { label: 'Avg QA', value: formatScoreLabel(section.avgQa), tone: 'neutral' },
    { label: 'Avg SEO', value: formatScoreLabel(section.avgSeo), tone: 'neutral' },
    {
      label: 'Total open issues',
      value: String(section.totalOpenA11yIssues + section.totalOpenQaIssues + section.totalOpenSeoIssues),
      tone: 'neutral'
    }
  ])

  const rows = section.sites.length
    ? section.sites.map(site => `
      <tr>
        <td>${escapeHtml(site.siteName)}</td>
        <td class="num">${escapeHtml(formatScoreLabel(site.accessibilityScore))}</td>
        <td class="num">${escapeHtml(formatScoreLabel(site.qaScore))}</td>
        <td class="num">${escapeHtml(formatScoreLabel(site.seoScore))}</td>
        <td class="num">${site.openA11yIssues}</td>
        <td class="num">${site.openQaIssues}</td>
        <td class="num">${site.openSeoIssues}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="7" class="empty">No site scan data available.</td></tr>'

  const body = `
    ${summaryCards}
    <div class="table-surface overview-table">
      <table>
        <thead>
          <tr>
            <th style="width:24%">Site</th>
            <th style="width:10%">A11y</th>
            <th style="width:10%">QA</th>
            <th style="width:10%">SEO</th>
            <th style="width:12%">A11y issues</th>
            <th style="width:12%">QA issues</th>
            <th style="width:12%">SEO issues</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `

  return renderOverviewShell(
    'All sites summary',
    'Per-site scores and open issue counts across your organization',
    body,
    overviewSectionAnchorId('overview.orgSummary'),
    eyebrowForOverviewSection('overview.orgSummary')
  )
}

const RENDERERS: Record<ReportOverviewSectionKey, (data: ReportOverviewData) => string> = {
  'overview.accessibility': renderAccessibilityOverview,
  'overview.qa': renderQaOverview,
  'overview.seo': renderSeoOverview,
  'overview.orgSummary': renderOrgSummary
}

const UNAVAILABLE_LABELS: Record<ReportOverviewSectionKey, string> = {
  'overview.accessibility': 'Accessibility overview',
  'overview.qa': 'QA overview',
  'overview.seo': 'SEO overview',
  'overview.orgSummary': 'All sites summary'
}

export function renderOverviewUnavailableHtml(sections: ReportOverviewSectionKey[]): string {
  const labels = sections.map(section => UNAVAILABLE_LABELS[section]).join(', ')
  return `
    <section class="overview-page report-section report-flow-section" data-report-eyebrow="Overview">
      <span class="aiq-section-marker" aria-hidden="true">%%AIQSEC:Overview|section-overview-unavailable%%</span>
      <div class="section-heading">
        <h2>Overview charts unavailable</h2>
        <p class="section-meta">
          ${escapeHtml(labels)} could not be rendered for this export. Regenerate the report after restarting the scanner service.
        </p>
      </div>
    </section>
  `
}

export function renderReportOverviewHtml(
  sections: ReportOverviewSectionKey[],
  data: ReportOverviewData
): string {
  return sections
    .map(section => RENDERERS[section]?.(data) ?? '')
    .filter(Boolean)
    .join('\n')
}
