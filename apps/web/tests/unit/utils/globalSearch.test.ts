import { describe, expect, it } from 'vitest'
import { latestPageIdsByNormalizedUrl } from '~/utils/pageUrl'
import {
  buildSnippet,
  compileSearchRegex,
  findMatchIndex,
  flattenPdfMetadata,
  highlightSnippet,
  normalizeSearchQuery,
  searchFields,
  webpageSearchFields
} from '~/utils/globalSearch'

describe('normalizeSearchQuery', () => {
  it('strips wrapping double quotes', () => {
    expect(normalizeSearchQuery('"MY PERSONAL CHALLENG"')).toBe('MY PERSONAL CHALLENG')
  })
})

describe('globalSearch matchers', () => {
  it('finds contains matches case-insensitively', () => {
    expect(findMatchIndex('Hello World', 'world', 'contains')).toBe(6)
    expect(findMatchIndex('Hello World', 'mars', 'contains')).toBeNull()
  })

  it('finds exact matches case-sensitively', () => {
    expect(findMatchIndex('Hello World', 'World', 'exact')).toBe(6)
    expect(findMatchIndex('Hello World', 'world', 'exact')).toBeNull()
  })

  it('finds regex matches', () => {
    expect(findMatchIndex('Hello World', 'World', 'regex')).toBe(6)
  })

  it('rejects invalid regex patterns', () => {
    expect(() => compileSearchRegex('(')).toThrow('Invalid regular expression')
  })

  it('searches webpage fields in priority order', () => {
    const fields = webpageSearchFields({
      url: 'https://example.com',
      title: 'Example',
      htmlSnapshot: '<p>alpha beta</p>'
    })
    const hit = searchFields(fields, 'beta', 'contains')
    expect(hit?.field.key).toBe('html_snapshot')
  })

  it('flattens PDF metadata for search', () => {
    const fields = flattenPdfMetadata({
      author: 'Jane',
      keywords: 'policy, handbook'
    })
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'author', value: 'Jane' }),
      expect.objectContaining({ key: 'keywords', value: 'policy, handbook' })
    ]))
  })
})

describe('highlightSnippet', () => {
  it('wraps the first case-insensitive match in mark', () => {
    const html = highlightSnippet('…the attendance policy applies…', 'policy')
    expect(html).toContain('<mark class="search-snippet-mark">policy</mark>')
  })

  it('escapes HTML in snippet text', () => {
    const html = highlightSnippet('<script>alert(1)</script>', 'script')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;')
    expect(html).toContain('mark')
  })
})

describe('buildSnippet', () => {
  it('returns context around the match', () => {
    const text = 'aaaa bbbb cccc dddd eeee'
    const snippet = buildSnippet(text, 10, 5)
    expect(snippet).toContain('bbbb')
    expect(snippet.startsWith('…')).toBe(true)
  })
})

describe('latestPageIdsByNormalizedUrl integration', () => {
  it('keeps only latest crawl rows per URL', () => {
    const allowed = latestPageIdsByNormalizedUrl([
      { id: 'old', url: 'https://example.com/a', ts: 100 },
      { id: 'new', url: 'https://example.com/a/', ts: 200 }
    ])
    expect(allowed.has('new')).toBe(true)
    expect(allowed.has('old')).toBe(false)
  })
})
