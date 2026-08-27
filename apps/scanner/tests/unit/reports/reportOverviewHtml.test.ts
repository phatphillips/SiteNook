import { describe, expect, it } from 'vitest'
import type { ReportOverviewData } from '../../../src/reports/buildReportOverviewData.js'
import { renderReportOverviewHtml, renderOverviewUnavailableHtml } from '../../../src/reports/reportOverviewHtml.js'
import { buildReportHtml } from '../../../src/reports/reportHtmlTemplate.js'

const sampleOverview: ReportOverviewData = {
  scopeLabel: 'Demo site',
  isAllSites: false,
  accessibility: {
    score: 82,
    levelA: 88,
    levelAA: 76,
    levelAAA: 60,
    bestPractices: 90,
    openIssues: 12,
    impactCounts: { critical: 1, serious: 3, moderate: 4, minor: 4 },
    trend: [
      { label: 'Jun 1', value: 78 },
      { label: 'Jun 2', value: 80 },
      { label: 'Jun 3', value: 82 }
    ],
    issuesTrend: [
      { label: 'Jun 1', value: 20 },
      { label: 'Jun 2', value: 15 },
      { label: 'Jun 3', value: 12 }
    ]
  },
  qa: {
    score: 91,
    brokenLinks: 2,
    misspellings: 5,
    policies: 0,
    avgReadability: 64
  }
}

describe('reportOverviewHtml', () => {
  it('renders selected overview sections with app-like columns', () => {
    const html = renderReportOverviewHtml(['overview.accessibility', 'overview.qa'], sampleOverview)
    expect(html).toContain('Accessibility overview')
    expect(html).toContain('Quality assurance overview')
    expect(html).toContain('Conformance levels')
    expect(html).toContain('Score trend')
    expect(html).toContain('Open issues')
    expect(html).toContain('metric-trend-card')
    expect(html).toContain('Broken links')
  })

  it('embeds landscape overview pages in the full report html', () => {
    const html = buildReportHtml([], {
      title: 'SiteNook Report',
      scopeLabel: 'Demo site',
      generatedAt: new Date().toISOString(),
      sections: [],
      overviewSections: ['overview.accessibility'],
      overviewData: sampleOverview
    })
    expect(html).toContain('Accessibility overview')
    expect(html).toContain('overview-page')
    expect(html).toContain('Accessibility Overview')
    expect(html).not.toContain('ACCESSIBILITY OVERVIEW')
    expect(html).toContain('chart-svg')
    expect(html).toContain('overview-top-grid')
    expect(html).toContain('site-target-badge--a')
    expect(html).not.toContain('landscape-overview')
  })

  it('shows a fallback page when overview data is missing', () => {
    const html = buildReportHtml([], {
      title: 'SiteNook Report',
      scopeLabel: 'Demo site',
      generatedAt: new Date().toISOString(),
      sections: [],
      overviewSections: ['overview.accessibility']
    })
    expect(html).toContain('Overview charts unavailable')
    expect(renderOverviewUnavailableHtml(['overview.accessibility'])).toContain('Accessibility overview')
  })
})
