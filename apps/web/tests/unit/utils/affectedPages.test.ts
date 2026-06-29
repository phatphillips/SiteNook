import { describe, it, expect } from 'vitest'
import {
  affectedPagesForRule,
  affectedPagesSummaryForRule,
  buildAffectedPagesByRule,
  openIssueIdsForPage,
  openIssueIdsForRule,
  pageDisplayTitle
} from '~/utils/affectedPages'
import type { AccessibilityIssue } from '~/types/accessiq'

function issue(partial: Partial<AccessibilityIssue> & { id: string, rule_id: string }): AccessibilityIssue {
  return {
    scan: 'scan-1',
    page: partial.id,
    wcag_level: 'AA',
    impact: 'serious',
    type: 'error',
    description: 'Test issue',
    status: 'open',
    ...partial
  }
}

describe('affectedPagesForRule', () => {
  it('returns unique pages with snippets for a rule', () => {
    const pages = affectedPagesForRule([
      issue({
        id: 'i1',
        rule_id: 'color-contrast',
        html_snippet: '<a>link</a>',
        expand: { page: { url: 'https://example.com/a' } }
      }),
      issue({
        id: 'i2',
        rule_id: 'color-contrast',
        html_snippet: '<button>btn</button>',
        expand: { page: { url: 'https://example.com/b' } }
      })
    ], 'color-contrast')

    expect(pages).toHaveLength(2)
    expect(pages.map(p => p.url).sort()).toEqual([
      'https://example.com/a',
      'https://example.com/b'
    ])
  })
})

describe('affectedPagesSummaryForRule', () => {
  it('aggregates occurrences and title per page', () => {
    const pages = affectedPagesSummaryForRule([
      issue({
        id: 'i1',
        rule_id: 'color-contrast',
        expand: { page: { url: 'https://example.com/a', title: 'Home' } }
      }),
      issue({
        id: 'i2',
        rule_id: 'color-contrast',
        expand: { page: { url: 'https://example.com/a', title: 'Home' } }
      }),
      issue({
        id: 'i3',
        rule_id: 'color-contrast',
        expand: { page: { url: 'https://example.com/b' } }
      })
    ], 'color-contrast', { statuses: ['open'] })

    expect(pages).toHaveLength(2)
    const home = pages.find(p => p.url.includes('/a'))
    expect(home?.title).toBe('Home')
    expect(home?.occurrences).toBe(2)
    expect(pageDisplayTitle({ url: 'https://example.com/b' })).toBe('/b')
  })

  it('buildAffectedPagesByRule maps rules to summaries', () => {
    const map = buildAffectedPagesByRule([
      issue({ id: 'i1', rule_id: 'a', expand: { page: { url: 'https://x.com/1' } } }),
      issue({ id: 'i2', rule_id: 'b', expand: { page: { url: 'https://x.com/2' } } })
    ], ['open'])
    expect(map.get('a')).toHaveLength(1)
    expect(map.get('b')).toHaveLength(1)
  })
})

describe('openIssueIdsForRule', () => {
  it('returns open issue ids for rule', () => {
    const ids = openIssueIdsForRule([
      issue({ id: 'i1', rule_id: 'r1', status: 'open' }),
      issue({ id: 'i2', rule_id: 'r1', status: 'fixed' }),
      issue({ id: 'i3', rule_id: 'r2', status: 'open' })
    ], 'r1')
    expect(ids).toEqual(['i1'])
  })
})

describe('openIssueIdsForPage', () => {
  it('returns open issue ids for normalized page url', () => {
    const ids = openIssueIdsForPage([
      issue({ id: 'i1', rule_id: 'r1', status: 'open', expand: { page: { url: 'https://example.com/path/' } } }),
      issue({ id: 'i2', rule_id: 'r2', status: 'open', expand: { page: { url: 'https://example.com/other' } } })
    ], 'https://example.com/path')
    expect(ids).toEqual(['i1'])
  })
})
