import { describe, expect, it } from 'vitest'

import {

  canSubmitReportSections,

  countSelectedDataSections,

  countSelectedOverviewSections,

  countSelectedReportSections,

  defaultReportSectionSelection,

  hasSelectedReportSections,

  listSelectedReportSectionLabels,

  normalizeReportSectionSelection

} from '~/utils/reportSections'



describe('reportSections', () => {

  it('uses stakeholder-friendly defaults', () => {

    const defaults = defaultReportSectionSelection()

    expect(defaults.overview.accessibility).toBe(true)

    expect(defaults.accessibility.issues).toBe(true)

    expect(countSelectedReportSections(defaults)).toBe(2)

  })



  it('counts overview and data sections separately', () => {

    const sections = defaultReportSectionSelection()

    sections.overview.qa = true

    sections.qa.brokenLinks = true

    expect(countSelectedOverviewSections(sections)).toBe(2)

    expect(countSelectedDataSections(sections)).toBe(2)

    expect(countSelectedReportSections(sections)).toBe(4)

  })



  it('counts selected detail sections', () => {

    expect(countSelectedReportSections({

      overview: { accessibility: false, qa: false, seo: false, orgSummary: false },

      accessibility: { issues: true, readability: false, pdfs: false, pages: false },

      qa: { brokenLinks: true, spelling: false, inventory: false },

      seo: { technical: true, content: false, preview: false }

    })).toBe(3)

  })



  it('returns false when no sections selected', () => {

    expect(hasSelectedReportSections({

      overview: { accessibility: false, qa: false, seo: false, orgSummary: false },

      accessibility: { issues: false, readability: false, pdfs: false, pages: false },

      qa: { brokenLinks: false, spelling: false, inventory: false },

      seo: { technical: false, content: false, preview: false }

    })).toBe(false)

  })



  it('backfills overview for legacy jobs', () => {

    const normalized = normalizeReportSectionSelection({

      accessibility: { issues: true, readability: false, pdfs: false, pages: false },

      qa: { brokenLinks: false, spelling: false, inventory: false },

      seo: { technical: false, content: false, preview: false }

    })

    expect(normalized.overview.accessibility).toBe(true)

    expect(normalized.accessibility.issues).toBe(true)

  })



  it('allows overview-only PDF jobs', () => {

    const sections = defaultReportSectionSelection()

    sections.accessibility.issues = false

    expect(canSubmitReportSections(sections, 'pdf')).toBe(true)

    expect(canSubmitReportSections(sections, 'csv')).toBe(false)

  })



  it('requires data sections for CSV exports', () => {

    const sections = defaultReportSectionSelection()

    sections.overview.accessibility = false

    expect(canSubmitReportSections(sections, 'csv')).toBe(true)

  })

  it('lists selected section labels for summaries', () => {
    const sections = defaultReportSectionSelection()
    sections.overview.qa = true
    sections.qa.brokenLinks = true
    const labels = listSelectedReportSectionLabels(sections)
    expect(labels).toContain('Table of contents')
    expect(labels).toContain('Accessibility overview')
    expect(labels).toContain('QA overview')
    expect(labels).toContain('Accessibility issues')
    expect(labels).toContain('Broken links')
  })

})


