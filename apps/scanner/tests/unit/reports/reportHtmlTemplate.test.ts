import { describe, expect, it } from 'vitest'
import { buildReportHtml } from '../../../src/reports/reportHtmlTemplate.js'
import type { ReportSectionData } from '../../../src/reports/types.js'

describe('buildReportHtml', () => {
  it('renders a light-theme cover, summary, and section tables', () => {
    const sections: ReportSectionData[] = [{
      key: 'accessibility.issues',
      label: 'Accessibility Issues',
      headers: ['rule_id', 'description', 'wcag_level', 'impact', 'page_url'],
      rows: [
        ['image-alt', 'Images must have alternative text', 'A', 'critical', 'https://example.com']
      ]
    }]

    const html = buildReportHtml(sections, {
      title: 'SiteNook Report',
      scopeLabel: 'All sites',
      orgName: 'Demo Org',
      generatedAt: '2026-07-10T05:59:00.000Z',
      sections,
      summary: {
        orgName: 'Demo Org',
        siteCount: 2,
        averageAccessibilityScore: 78.5,
        totalOpenIssues: 42,
        criticalIssueRules: 3,
        sectionTotals: [{ label: 'Accessibility Issues', count: 1 }],
        topIssues: [{
          title: 'Images must have alternative text',
          impact: 'critical',
          pages: 1,
          occurrences: 1
        }]
      }
    })

    expect(html).toContain('cover-page')
    expect(html.toLowerCase()).toContain('background: #ffffff')
    expect(html).toContain('Executive summary')
    expect(html).toContain('Priority issue details')
    expect(html).toContain('Images must have alternative text')
    expect(html).toContain('severity-critical')
    expect(html).toContain('https://example.com')
    expect(html).toContain('#0B1F3A')
    expect(html).toContain('linear-gradient(')
    expect(html).toContain('height: 297mm')
    expect(html).toContain('overflow: hidden')
    expect(html).toContain('table-header-group')
    expect(html).toContain('border-collapse: collapse')
    expect(html).not.toContain('toc-leader')
    expect(html).not.toContain('margin: 26mm')
  })

  it('escapes unsafe html in cell values', () => {
    const sections: ReportSectionData[] = [{
      key: 'qa.links',
      label: 'QA Broken Links',
      headers: ['page_url', 'href', 'status_code', 'link_type', 'status'],
      rows: [['https://example.com', '<script>alert(1)</script>', '404', 'internal', 'open']]
    }]

    const html = buildReportHtml(sections, {
      title: 'SiteNook Report',
      scopeLabel: 'Demo site',
      generatedAt: '2026-07-10T05:59:00.000Z',
      sections
    })

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})
