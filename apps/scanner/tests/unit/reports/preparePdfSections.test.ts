import { describe, expect, it } from 'vitest'
import { preparePdfSections } from '../../../src/reports/preparePdfSections.js'
import type { ReportSectionData } from '../../../src/reports/types.js'

describe('preparePdfSections', () => {
  it('aggregates accessibility issues by rule like the dashboard table', () => {
    const section: ReportSectionData = {
      key: 'accessibility.issues',
      label: 'Accessibility Issues',
      headers: ['rule_id', 'description', 'wcag_level', 'impact', 'page_url'],
      rows: [
        ['color-contrast', 'Elements must meet minimum color contrast ratio thresholds', 'AA', 'serious', 'https://example.com/a'],
        ['color-contrast', 'Elements must meet minimum color contrast ratio thresholds', 'AA', 'serious', 'https://example.com/b'],
        ['image-alt', 'Images must have alternative text', 'A', 'critical', 'https://example.com/a']
      ]
    }

    const [prepared] = preparePdfSections([section])
    expect(prepared?.columns.map(column => column.label)).toEqual([
      'Issue',
      'Level',
      'Severity',
      'Pages',
      'Occurrences'
    ])
    expect(prepared?.rows).toHaveLength(2)
    expect(prepared?.rows[0]?.[0]).toBe('Images must have alternative text')
    expect(prepared?.rows[1]).toEqual([
      'Elements must meet minimum color contrast ratio thresholds',
      'AA',
      'Serious',
      '2',
      '2'
    ])
  })

  it('maps broken link columns to website labels', () => {
    const section: ReportSectionData = {
      key: 'qa.links',
      label: 'QA Broken Links',
      headers: ['page_url', 'href', 'status_code', 'link_type', 'status'],
      rows: [['https://example.com', 'https://example.com/missing', '404', 'internal', 'open']]
    }

    const [prepared] = preparePdfSections([section])
    expect(prepared?.columns.map(column => column.label)).toEqual([
      'Page',
      'Broken URL',
      'HTTP',
      'Type',
      'Status'
    ])
  })

  it('puts title first and labels readability scores with the active method', () => {
    const section: ReportSectionData = {
      key: 'accessibility.readability',
      label: 'Readability',
      headers: ['url', 'title', 'word_count', 'readability_score', 'readability_scores'],
      rows: [[
        'https://example.com/about',
        'About us',
        '420',
        '70',
        JSON.stringify({ flesch_kincaid_grade: 8.2, flesch_reading_ease: 70 })
      ]]
    }

    const [prepared] = preparePdfSections([section], {
      readabilityMethodId: 'flesch_kincaid_grade',
      readabilityMethodLabel: 'Flesch-Kincaid Grade Level'
    })
    expect(prepared?.columns.map(column => column.label)).toEqual([
      'Title',
      'Score',
      'Words',
      'Page URL'
    ])
    expect(prepared?.rows[0]?.[0]).toBe('About us')
    expect(prepared?.rows[0]?.[1]).toBe('Grade 8.2 · Moderate')
    expect(prepared?.metaNote).toContain('Flesch-Kincaid Grade Level')
  })

  it('builds a useful PDF accessibility table from pdf_documents fields', () => {
    const section: ReportSectionData = {
      key: 'accessibility.pdfs',
      label: 'PDF Accessibility',
      headers: [
        'document_title',
        'filename',
        'status',
        'machine_readable',
        'has_pdf_tags',
        'issue_count',
        'accessibility_score'
      ],
      rows: [['Annual report', 'annual.pdf', 'complete', 'true', 'true', '3', '72']]
    }

    const [prepared] = preparePdfSections([section])
    expect(prepared?.columns[0]?.label).toBe('Title')
    expect(prepared?.rows[0]).toEqual([
      'Annual report',
      '72 / 100',
      '3',
      'Yes',
      'Yes',
      'Complete'
    ])
  })
})
