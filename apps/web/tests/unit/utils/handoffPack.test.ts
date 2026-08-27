import { describe, expect, it } from 'vitest'
import {
  buildHandoffTaskMarkdown,
  buildHandoffTreeMarkdown,
  wrapPageMarkdown
} from '~/utils/handoffPack'

describe('handoffPack', () => {
  it('builds TREE.md with folder ancestors and page links', () => {
    const md = buildHandoffTreeMarkdown([
      { url: 'https://example.com/blog/post-a', title: 'Post A', filePath: 'blog/post-a.md' },
      { url: 'https://example.com/about', title: 'About', filePath: 'about.md' }
    ])
    expect(md).toContain('# Selected pages')
    expect(md).toContain('**blog/**')
    expect(md).toContain('[Post A](pages/blog/post-a.md)')
    expect(md).toContain('[About](pages/about.md)')
  })

  it('builds task.md with prompt and usage instructions', () => {
    const md = buildHandoffTaskMarkdown({
      prompt: 'Rewrite for clarity.',
      siteName: 'Example',
      siteUrl: 'https://example.com',
      section: 'content',
      pageCount: 2
    })
    expect(md).toContain('Rewrite for clarity.')
    expect(md).toContain('**Section:** Content')
    expect(md).toContain('TREE.md')
    expect(md).toContain('Do not assume unlisted pages are in scope.')
  })

  it('wraps page markdown with frontmatter and optional findings', () => {
    const withFindings = wrapPageMarkdown({
      body: '# Hello\n\nBody',
      url: 'https://example.com/about',
      title: 'About',
      section: 'accessibility',
      findingsBlock: '- color-contrast (serious)'
    })
    expect(withFindings).toContain('section: accessibility')
    expect(withFindings).toContain('## Known findings from SiteNook')
    expect(withFindings).toContain('color-contrast')

    const plain = wrapPageMarkdown({
      body: 'Plain',
      url: 'https://example.com/',
      section: 'content'
    })
    expect(plain).not.toContain('Known findings')
  })
})
