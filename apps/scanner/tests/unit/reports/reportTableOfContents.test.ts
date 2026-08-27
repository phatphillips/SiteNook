import { describe, expect, it } from 'vitest'
import {
  buildReportTocEntries,
  renderTableOfContentsHtml
} from '../../../src/reports/reportTableOfContents.js'
import { buildReportHtml } from '../../../src/reports/reportHtmlTemplate.js'
import type { ReportOverviewData } from '../../../src/reports/buildReportOverviewData.js'

const sampleOverview: ReportOverviewData = {
  scopeLabel: 'Anything is Possible',
  isAllSites: false,
  accessibility: {
    score: 82.9,
    levelA: 54.5,
    levelAA: 78.1,
    levelAAA: 46.8,
    bestPractices: 90,
    openIssues: 941,
    impactCounts: { critical: 10, serious: 920, moderate: 5, minor: 6 },
    trend: [
      { label: 'Jun 11', value: 0 },
      { label: 'Jun 20', value: 80 },
      { label: 'Jul 10', value: 82.9 }
    ],
    issuesTrend: [
      { label: 'Jun 11', value: 1200 },
      { label: 'Jun 20', value: 980 },
      { label: 'Jul 10', value: 941 }
    ]
  }
}

describe('reportTableOfContents', () => {
  it('builds linked toc entries for overview and detail sections', () => {
    const entries = buildReportTocEntries({
      includeExecutiveSummary: true,
      overviewSections: ['overview.accessibility'],
      dataSections: ['accessibility.issues']
    })
    expect(entries.map(entry => entry.id)).toEqual([
      'section-executive-summary',
      'section-overview-accessibility',
      'section-accessibility-issues'
    ])
    const html = renderTableOfContentsHtml(entries)
    expect(html).toContain('Table of contents')
    expect(html).toContain('href="#section-overview-accessibility"')
    expect(html).toContain('toc-list')
    expect(html).toContain('toc-badge')
    expect(html).toContain('Jump to a section')
    expect(html).not.toContain('<thead>')
    expect(html).not.toContain('toc-leader')
    expect(html).not.toContain('In this report')
  })
})

describe('overview design polish', () => {
  it('keeps open-issue caption outside the donut score', () => {
    const html = buildReportHtml([], {
      title: 'SiteNook Report',
      scopeLabel: 'Anything is Possible',
      generatedAt: new Date().toISOString(),
      sections: [],
      includeTableOfContents: true,
      overviewSections: ['overview.accessibility'],
      overviewData: sampleOverview,
      summary: {
        orgName: 'Monkey',
        siteCount: 1,
        averageAccessibilityScore: 82.9,
        totalOpenIssues: 941,
        criticalIssueRules: 10,
        sectionTotals: [],
        topIssues: []
      }
    })
    expect(html).toContain('Table of contents')
    expect(html).toContain('donut-caption')
    expect(html).toContain('941 open issues')
    expect(html).toContain('donut-label')
    expect(html).toContain('Site target score')
    expect(html).toContain('metric-card-critical')
    expect(html).toContain('metric-trend-card')
    expect(html).toContain('toc-list')
    expect(html).toContain('Conformance levels')
    expect(html).not.toContain('<table class="toc-table')
  })
})
