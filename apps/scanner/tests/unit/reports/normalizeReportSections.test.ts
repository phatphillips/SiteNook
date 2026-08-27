import { describe, expect, it } from 'vitest'
import { normalizeReportSectionSelection } from '../../../src/reports/normalizeReportSections.js'
import { selectedOverviewSections } from '../../../src/reports/types.js'

describe('normalizeReportSections', () => {
  it('preserves explicit overview selections', () => {
    const normalized = normalizeReportSectionSelection({
      overview: { accessibility: true, qa: false, seo: false, orgSummary: false },
      accessibility: { issues: true }
    })
    expect(selectedOverviewSections(normalized)).toEqual(['overview.accessibility'])
  })

  it('does not invent overview sections for legacy payloads', () => {
    const normalized = normalizeReportSectionSelection({
      accessibility: { issues: true }
    })
    expect(selectedOverviewSections(normalized)).toEqual([])
  })
})
