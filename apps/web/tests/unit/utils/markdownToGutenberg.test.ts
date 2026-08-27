import { describe, expect, it } from 'vitest'
import { markdownToGutenbergBlocks } from '~/utils/markdownToGutenberg'

describe('markdownToGutenbergBlocks', () => {
  it('converts common extracted Markdown structures to Gutenberg blocks', () => {
    const result = markdownToGutenbergBlocks([
      '# Page title',
      '',
      'A **strong** paragraph with a [link](https://example.com).',
      '',
      '- First',
      '- Second',
      '',
      '> A quotation',
      '',
      '```',
      '<button>Example</button>',
      '```'
    ].join('\n'))

    expect(result).toContain('<!-- wp:heading {"level":1} -->')
    expect(result).toContain('<strong>strong</strong>')
    expect(result).toContain('<a href="https://example.com">link</a>')
    expect(result).toContain('<!-- wp:list -->')
    expect(result).toContain('<li>First</li>')
    expect(result).toContain('<!-- wp:quote -->')
    expect(result).toContain('&lt;button&gt;Example&lt;/button&gt;')
  })

  it('returns an empty string for empty Markdown', () => {
    expect(markdownToGutenbergBlocks('   ')).toBe('')
  })
})
