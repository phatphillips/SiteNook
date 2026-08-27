import { describe, expect, it } from 'vitest'
import {
  buildContentExplorerTree,
  filterContentExplorerTree,
  firstMarkdownHeading,
  flattenContentExplorerPages,
  htmlExportFilename,
  markdownExportFilename,
  resolveContentExplorerTitle
} from '~/utils/contentExplorerTree'
import { pickDefaultContentExplorerEntry } from '~/utils/pickDefaultContentExplorerEntry'
import type { ContentExplorerEntry } from '~/types/sitenook'

function entry(partial: Partial<ContentExplorerEntry> & Pick<ContentExplorerEntry, 'id' | 'url'>): ContentExplorerEntry {
  return {
    title: partial.title ?? partial.url,
    unchanged: false,
    hasContent: true,
    failed: false,
    ...partial
  }
}

describe('contentExplorerTree', () => {
  it('merges a page at a path with children under the same node', () => {
    const tree = buildContentExplorerTree([
      entry({ id: '1', url: 'https://example.com/blog', title: 'Blog' }),
      entry({ id: '2', url: 'https://example.com/blog/post-a', title: 'Post A' })
    ])

    expect(tree).toHaveLength(1)
    const blog = tree[0]!
    expect(blog.path).toBe('/blog')
    expect(blog.entry?.id).toBe('1')
    expect(blog.entry?.title).toBe('Blog')
    expect(blog.children).toHaveLength(1)
    expect(blog.children?.[0]?.entry?.id).toBe('2')
    expect(blog.children?.[0]?.label).toBe('Post A')

    // No duplicate sibling folder+page for the same path
    expect(tree.filter(n => n.path === '/blog')).toHaveLength(1)
  })

  it('keeps prefix-only folders without an entry when only children exist', () => {
    const tree = buildContentExplorerTree([
      entry({ id: '2', url: 'https://example.com/blog/post-a', title: 'Post A' })
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.path).toBe('/blog')
    expect(tree[0]!.entry).toBeUndefined()
    expect(tree[0]!.children?.[0]?.entry?.title).toBe('Post A')
  })

  it('builds nested paths and flattens all page entries', () => {
    const tree = buildContentExplorerTree([
      entry({ id: '1', url: 'https://example.com/blog/post-a', title: 'Post A' }),
      entry({ id: '2', url: 'https://example.com/about', title: 'About' })
    ])
    const pages = flattenContentExplorerPages(tree)
    expect(pages).toHaveLength(2)
    expect(pages.map(p => p.title).sort()).toEqual(['About', 'Post A'])
  })

  it('filters pages by search query including parent labels', () => {
    const tree = buildContentExplorerTree([
      entry({ id: '1', url: 'https://example.com/blog/post-a', title: 'Post A' }),
      entry({ id: '2', url: 'https://example.com/about', title: 'About' })
    ])
    const filtered = filterContentExplorerTree(tree, 'about')
    const pages = flattenContentExplorerPages(filtered)
    expect(pages).toHaveLength(1)
    expect(pages[0]?.title).toBe('About')
  })

  it('sanitizes markdown export filenames from URLs', () => {
    expect(markdownExportFilename('https://example.com/blog/my-post', 'My Post'))
      .toBe('blog/my-post.md')
    expect(markdownExportFilename('https://example.com/', 'Home'))
      .toMatch(/\.md$/)
    expect(htmlExportFilename('https://example.com/blog/my-post', 'My Post'))
      .toBe('blog/my-post.html')
    expect(htmlExportFilename('https://example.com/', 'Home'))
      .toBe('home.html')
  })

  it('places the homepage just below folder groups', () => {
    const tree = buildContentExplorerTree([
      entry({ id: '1', url: 'https://example.com/about', title: 'About' }),
      entry({ id: '2', url: 'https://example.com/', title: 'Home - Example' }),
      entry({ id: '3', url: 'https://example.com/blog/post', title: 'Post' }),
      entry({ id: '4', url: 'https://example.com/ambassadors', title: 'Ambassadors' }),
      entry({ id: '5', url: 'https://example.com/ambassadors/join', title: 'Join' }),
      entry({ id: '6', url: 'https://example.com/resources', title: 'Resources' })
    ])
    expect(tree.map(n => n.path)).toEqual(['/ambassadors', '/blog', '/', '/about', '/resources'])
    expect(tree[2]!.entry?.title).toBe('Home - Example')
  })

  it('sorts pages with subpages before leaf pages', () => {
    const tree = buildContentExplorerTree([
      entry({ id: '1', url: 'https://example.com/about', title: 'About' }),
      entry({ id: '2', url: 'https://example.com/blog', title: 'Blog' }),
      entry({ id: '3', url: 'https://example.com/blog/post', title: 'Post' }),
      entry({ id: '4', url: 'https://example.com/zebra', title: 'Zebra' }),
      entry({ id: '5', url: 'https://example.com/ambassadors', title: 'Ambassadors' }),
      entry({ id: '6', url: 'https://example.com/ambassadors/join', title: 'Join' })
    ])

    expect(tree.map(n => n.path)).toEqual(['/ambassadors', '/blog', '/about', '/zebra'])
    expect(tree[0]!.children?.[0]?.label).toBe('Join')
    expect(tree[1]!.children?.[0]?.label).toBe('Post')
  })

  it('resolves display titles preferring PB title then markdown heading', () => {
    expect(resolveContentExplorerTitle(entry({
      id: '1',
      url: 'https://example.com/a',
      title: ''
    }), '# Hello World\n\nBody')).toBe('Hello World')

    expect(resolveContentExplorerTitle(entry({
      id: '1',
      url: 'https://example.com/a',
      title: 'https://example.com/a'
    }), '## From markdown')).toBe('From markdown')

    expect(resolveContentExplorerTitle(entry({
      id: '1',
      url: 'https://example.com/a',
      title: 'Real Title'
    }), '# Ignored')).toBe('Real Title')
  })

  it('extracts the first markdown heading', () => {
    expect(firstMarkdownHeading('Intro\n\n# Main\n\n## Sub')).toBe('Main')
    expect(firstMarkdownHeading('no heading here')).toBeNull()
  })

  it('picks the site home or index page as the default preview', () => {
    const about = entry({ id: '1', url: 'https://example.com/about', title: 'About' })
    const home = entry({ id: '2', url: 'https://example.com/', title: 'Home' })
    const index = entry({ id: '3', url: 'https://example.com/index.html', title: 'Index' })
    expect(pickDefaultContentExplorerEntry([about, home, index])?.id).toBe('2')
    expect(pickDefaultContentExplorerEntry([about, index])?.id).toBe('3')
    expect(pickDefaultContentExplorerEntry([
      about,
      entry({ id: '4', url: 'https://example.com/contact', title: 'Home - Site' })
    ])?.id).toBe('4')
    expect(pickDefaultContentExplorerEntry([about])?.id).toBe('1')
    expect(pickDefaultContentExplorerEntry([])).toBeNull()
  })
})
