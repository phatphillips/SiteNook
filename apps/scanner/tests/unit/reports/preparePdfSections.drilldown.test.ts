import { describe, expect, it } from 'vitest'
import { preparePdfSections } from '../../../src/reports/preparePdfSections.js'
import type { ReportSectionData } from '../../../src/reports/types.js'

describe('preparePdfSections drill-down', () => {
  it('includes affected page urls for top accessibility issues', () => {
    const section: ReportSectionData = {
      key: 'accessibility.issues',
      label: 'Accessibility Issues',
      headers: ['rule_id', 'description', 'wcag_level', 'impact', 'page_url'],
      rows: [
        ['image-alt', 'Images must have alternative text', 'A', 'critical', 'https://example.com/a'],
        ['image-alt', 'Images must have alternative text', 'A', 'critical', 'https://example.com/b']
      ]
    }

    const [prepared] = preparePdfSections([section])
    expect(prepared?.issueDrillDown?.[0]?.pages).toEqual([
      'https://example.com/a',
      'https://example.com/b'
    ])
  })
})
