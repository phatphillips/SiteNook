import { describe, expect, it } from 'vitest'
import { buildA11ySummary } from '../../../src/accessibility/buildA11ySummary.js'

describe('buildA11ySummary', () => {
  it('aggregates open issues by rule and severity', () => {
    const summary = buildA11ySummary(
      [
        {
          rule_id: 'color-contrast',
          wcag_level: 'AA',
          impact: 'serious',
          status: 'open',
          page_url: 'https://example.com/a'
        },
        {
          rule_id: 'color-contrast',
          wcag_level: 'AA',
          impact: 'serious',
          status: 'open',
          page_url: 'https://example.com/b'
        },
        {
          rule_id: 'image-alt',
          wcag_level: 'A',
          impact: 'critical',
          status: 'open',
          page_url: 'https://example.com/a'
        },
        {
          rule_id: 'image-alt',
          wcag_level: 'A',
          impact: 'critical',
          status: 'dismissed',
          page_url: 'https://example.com/c'
        }
      ],
      { pageCount: 3, elementTotals: { image: 2, link: 1, form: 0, heading: 1, table: 0, media: 0, aria: 0, other: 1 } }
    )

    expect(summary.page_count).toBe(3)
    expect(summary.open_issue_count).toBe(3)
    expect(summary.by_severity.serious).toBe(2)
    expect(summary.by_severity.critical).toBe(1)
    expect(summary.by_level.A).toBe(1)
    expect(summary.by_level.AA).toBe(2)

    const contrast = summary.by_rule.find(r => r.rule_id === 'color-contrast')
    expect(contrast?.open_count).toBe(2)
    expect(contrast?.page_count).toBe(2)
    expect(contrast?.sample_page_urls).toHaveLength(2)

    const alt = summary.by_rule.find(r => r.rule_id === 'image-alt')
    expect(alt?.open_count).toBe(1)
    expect(alt?.dismissed_count).toBe(1)
  })

  it('returns empty summary for no issues', () => {
    const summary = buildA11ySummary([], { pageCount: 0 })
    expect(summary.open_issue_count).toBe(0)
    expect(summary.by_rule).toEqual([])
  })
})
