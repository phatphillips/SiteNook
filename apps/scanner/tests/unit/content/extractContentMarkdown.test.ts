import { describe, expect, it } from 'vitest'
import { extractContentMarkdown } from '../../../src/content/extractContentMarkdown.js'
import { hashMarkdownContent, normalizeMarkdownForHash } from '../../../src/content/contentHash.js'

const SAMPLE_HTML = `<!DOCTYPE html><html><head><title>Test</title></head><body>
<nav><a href="/">Home</a></nav>
<main><article>
<h1>Hello World</h1>
<p>This is a <strong>sample</strong> article with a <a href="https://example.com">link</a>.</p>
<ul><li>One</li><li>Two</li></ul>
</article></main>
<footer>Copyright</footer>
</body></html>`

describe('extractContentMarkdown', () => {
  it('extracts structured markdown from article HTML', () => {
    const md = extractContentMarkdown(SAMPLE_HTML, 'https://example.com/blog/post')
    expect(md).toBeTruthy()
    expect(md).toContain('Hello World')
    expect(md).toContain('sample')
    expect(md).not.toContain('Copyright')
  })

  it('returns null for empty HTML', () => {
    expect(extractContentMarkdown('', 'https://example.com')).toBeNull()
  })
})

describe('contentHash', () => {
  it('normalizes whitespace consistently', () => {
    const a = normalizeMarkdownForHash('Hello\n\n\n\nWorld\r\n')
    const b = normalizeMarkdownForHash('Hello\n\nWorld\n')
    expect(a).toBe(b)
  })

  it('produces stable sha256 hex', () => {
    const h1 = hashMarkdownContent('# Title\n\nBody')
    const h2 = hashMarkdownContent('# Title\n\nBody')
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[a-f0-9]{64}$/)
  })
})
