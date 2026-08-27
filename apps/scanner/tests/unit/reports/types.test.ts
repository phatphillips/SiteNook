import { describe, expect, it } from 'vitest'
import {
  hasAnySelectedSections,
  selectedDataSections,
  selectedOverviewSections,
  selectedSections
} from '../../../src/reports/types.js'

describe('report section selection', () => {
  it('collects overview and data keys', () => {
    const input = {
      overview: { accessibility: true, qa: false, seo: true, orgSummary: true },
      accessibility: { issues: true },
      qa: { brokenLinks: true },
      seo: { technical: false, content: true }
    }

    expect(selectedOverviewSections(input)).toEqual([
      'overview.accessibility',
      'overview.seo',
      'overview.orgSummary'
    ])
    expect(selectedDataSections(input)).toEqual([
      'accessibility.issues',
      'qa.links',
      'seo.content'
    ])
    expect(selectedSections(input)).toHaveLength(6)
    expect(hasAnySelectedSections(input)).toBe(true)
  })

  it('returns false when nothing is selected', () => {
    expect(hasAnySelectedSections({
      overview: { accessibility: false, qa: false, seo: false, orgSummary: false },
      accessibility: { issues: false },
      qa: { brokenLinks: false },
      seo: { technical: false }
    })).toBe(false)
  })
})
