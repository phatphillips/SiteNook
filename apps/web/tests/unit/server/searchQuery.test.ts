import { describe, expect, it } from 'vitest'
import {
  buildSearchFilter,
  escapeFilterValue,
  matchedFieldLabel,
  snippetFromHighlight,
  typesenseQueryForMode
} from '../../../server/utils/searchQuery'

describe('searchQuery', () => {
  it('builds org and site filters', () => {
    expect(buildSearchFilter('org-1')).toBe('orgId:=`org-1`')
    expect(buildSearchFilter('org-1', 'site-2')).toBe('orgId:=`org-1` && siteId:=`site-2`')
    expect(buildSearchFilter('org-1', undefined, 'pdfs')).toBe('orgId:=`org-1` && type:=pdf')
  })

  it('escapes backticks in filter values', () => {
    expect(escapeFilterValue('a`b')).toBe('`a\\`b`')
  })

  it('maps exact mode to quoted phrase', () => {
    expect(typesenseQueryForMode('hello world', 'exact')).toBe('"hello world"')
    expect(typesenseQueryForMode('say "hi"', 'exact')).toBe('"say \\"hi\\""')
    expect(typesenseQueryForMode('hello', 'contains')).toBe('hello')
  })

  it('maps highlight snippets to matched field labels', () => {
    const mapped = snippetFromHighlight(
      [{ field: 'body', snippet: '…<mark>match</mark>…' }],
      {
        id: 'webpage:1',
        orgId: 'org',
        siteId: 'site',
        siteName: 'Site',
        url: 'https://example.com',
        urlKey: 'https://example.com',
        type: 'webpage',
        lastScannedAt: 1
      }
    )
    expect(mapped?.matchedIn).toBe('HTML')
    expect(mapped?.snippet).toContain('match')
    expect(matchedFieldLabel('pdfAuthor', 'pdf')).toBe('PDF Author')
  })
})
