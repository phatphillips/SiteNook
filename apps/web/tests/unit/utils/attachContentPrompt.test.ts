import { describe, expect, it } from 'vitest'
import { attachPromptToPageContent } from '~/utils/attachContentPrompt'

describe('attachPromptToPageContent', () => {
  it('returns content unchanged when the prompt is empty', () => {
    expect(attachPromptToPageContent('# Page', '  ', 'markdown')).toBe('# Page')
  })

  it('prepends a markdown task block', () => {
    const result = attachPromptToPageContent('# Hello', 'Rewrite for clarity.', 'markdown')
    expect(result).toContain('## Task prompt')
    expect(result).toContain('Rewrite for clarity.')
    expect(result).toContain('# Hello')
    expect(result.indexOf('Task prompt')).toBeLessThan(result.indexOf('# Hello'))
  })

  it('injects an HTML comment after body when present', () => {
    const html = '<html><body><p>Hi</p></body></html>'
    const result = attachPromptToPageContent(html, 'Fix links.', 'html')
    expect(result).toContain('<!-- SiteNook task prompt')
    expect(result).toContain('Fix links.')
    expect(result).toMatch(/<body[^>]*>\s*<!-- SiteNook task prompt/)
  })

  it('wraps Gutenberg output in paragraph blocks', () => {
    const result = attachPromptToPageContent('<!-- wp:paragraph -->\n<p>Body</p>\n<!-- /wp:paragraph -->', 'Merge copy.', 'gutenberg')
    expect(result).toContain('<strong>Task prompt</strong>')
    expect(result).toContain('Merge copy.')
    expect(result).toContain('<p>Body</p>')
  })
})
