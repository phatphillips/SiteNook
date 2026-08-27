import { describe, expect, it } from 'vitest'
import { escapeCsv, buildCsv, exportFilename } from '~/utils/csvExport'
import { fetchAllPages } from '~/utils/fetchAllPages'
import {
  mainPageCount,
  resolveMainRows,
  resolveSubRows,
  sliceCurrentPage,
  isColumnVisible
} from '~/utils/tableExportScope'
import { buildIssuesCsv } from '~/utils/export/issuesExport'
import { buildPagesBreakdownRows, buildPagesBreakdownCsv } from '~/utils/export/pagesBreakdownExport'
import { buildBrokenLinksCsv } from '~/utils/export/brokenLinksExport'
import { buildPolicyMatchesCsv } from '~/utils/export/policyMatchesExport'
import type { AccessibilityIssue } from '~/types/sitenook'

describe('csvExport', () => {
  it('escapes commas and quotes', () => {
    expect(escapeCsv('hello')).toBe('hello')
    expect(escapeCsv('a,b')).toBe('"a,b"')
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""')
  })

  it('builds csv with headers and rows', () => {
    const csv = buildCsv(['Name', 'Count'], [['Alpha', '1']])
    expect(csv).toContain('Name,Count')
    expect(csv).toContain('Alpha,1')
  })

  it('builds export filenames', () => {
    expect(exportFilename('issues', 'org')).toMatch(/^issues-org-\d{4}-\d{2}-\d{2}\.csv$/)
  })
})

describe('fetchAllPages', () => {
  it('fetches every page', async () => {
    const pages = await fetchAllPages(async (page) => ({
      items: [`row-${page}`],
      total: 3,
      perPage: 1
    }))
    expect(pages).toEqual(['row-1', 'row-2', 'row-3'])
  })
})

describe('tableExportScope', () => {
  it('counts main pages', () => {
    expect(mainPageCount(0, 20)).toBe(0)
    expect(mainPageCount(21, 20)).toBe(2)
  })

  it('slices current page rows', () => {
    const rows = ['a', 'b', 'c', 'd']
    expect(sliceCurrentPage(rows, 2, 2)).toEqual(['c', 'd'])
  })

  it('resolves main and sub row scopes', () => {
    const rows = [1, 2, 3, 4]
    expect(resolveMainRows(rows, { mainRowScope: 'all' }, 1, 2)).toEqual(rows)
    expect(resolveMainRows(rows, { mainRowScope: 'current' }, 2, 2)).toEqual([3, 4])
    expect(resolveSubRows(['a', 'b', 'c'], { subRowScope: 'current' }, 0, 2)).toEqual(['a', 'b'])
  })

  it('respects column visibility defaults', () => {
    expect(isColumnVisible(undefined, 'issue')).toBe(true)
    expect(isColumnVisible({ issue: false }, 'issue')).toBe(false)
  })
})

describe('issuesExport', () => {
  const issue: AccessibilityIssue = {
    id: '1',
    rule_id: 'color-contrast',
    impact: 'serious',
    wcag_level: 'AA',
    status: 'open',
    page: 'p1',
    scan: 's1'
  }

  it('builds main-table csv', () => {
    const csv = buildIssuesCsv([issue], new Map(), {
      includeSubtable: false,
      ctx: {
        ruleStats: new Map([['color-contrast', { pages: 2, occurrences: 3 }]]),
        pointsToGainByRule: new Map([['color-contrast', 1.5]])
      }
    })
    expect(csv).toContain('Color Contrast')
    expect(csv).toContain('AA')
  })

  it('denormalizes affected pages', () => {
    const csv = buildIssuesCsv([issue], new Map([
      [':color-contrast', [{ url: 'https://example.com', occurrences: 2 }]]
    ]), {
      includeSubtable: true,
      ctx: {}
    })
    expect(csv).toContain('Page URL')
    expect(csv).toContain('https://example.com')
  })
})

describe('pagesBreakdownExport', () => {
  it('aggregates pages and nested issues', () => {
    const issues: AccessibilityIssue[] = [{
      id: '1',
      rule_id: 'color-contrast',
      impact: 'serious',
      wcag_level: 'AA',
      status: 'open',
      page: 'p1',
      scan: 's1',
      expand: { page: { id: 'p1', url: 'https://example.com/a', title: 'A' } }
    }]
    const rows = buildPagesBreakdownRows(issues)
    expect(rows).toHaveLength(1)
    const csv = buildPagesBreakdownCsv(rows, new Map(), { includeSubtable: true })
    expect(csv).toContain('https://example.com/a')
    expect(csv).toContain('Color Contrast')
  })
})

describe('brokenLinksExport', () => {
  it('exports flat links', () => {
    const csv = buildBrokenLinksCsv([{
      id: '1',
      href: 'https://broken.example',
      status_code: 404,
      link_type: 'a',
      status: 'broken',
      page: 'p1',
      scan: 's1',
      expand: { page: { id: 'p1', url: 'https://example.com' } }
    }], 'links')
    expect(csv).toContain('https://broken.example')
    expect(csv).toContain('404')
  })
})

describe('policyMatchesExport', () => {
  it('exports matches with optional site column', () => {
    const row = {
      id: '1',
      scan: 's1',
      policy: 'pol-1',
      page: 'p1',
      matched_text: 'acme',
      context: '… acme …',
      status: 'open' as const,
      siteName: 'Example',
      expand: {
        page: { url: 'https://example.com/a' },
        policy: {
          id: 'pol-1',
          name: 'Brand',
          category: 'brand' as const,
          severity: 'warning' as const,
          pattern: 'acme',
          rule_type: 'keyword' as const
        }
      }
    }
    const csv = buildPolicyMatchesCsv([row], { showSiteColumn: true })
    expect(csv).toContain('Site,Policy,Matched Text')
    expect(csv).toContain('Example')
    expect(csv).toContain('Brand')
    expect(csv).toContain('acme')
    expect(csv).toContain('https://example.com/a')
  })
})
