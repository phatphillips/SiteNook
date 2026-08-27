import { describe, expect, it } from 'vitest'
import {
  bodyTextFromPost,
  featuredPosts,
  formatAuthors,
  formatReadingTime,
  readingTimeMinutes,
  relatedPosts,
  sortPostsByDateDesc
} from '~/utils/blog'
import { markdownToHtml, parseBlogFrontmatter } from '~/utils/blogMarkdown'

describe('blog utils', () => {
  it('estimates reading time from word count', () => {
    const words = Array.from({ length: 400 }, () => 'word').join(' ')
    expect(readingTimeMinutes(words)).toBe(2)
    expect(formatReadingTime(2)).toBe('2 min read')
    expect(readingTimeMinutes('')).toBe(1)
  })

  it('formats authors', () => {
    expect(formatAuthors([])).toBe('SiteNook Team')
    expect(formatAuthors(['Ada'])).toBe('Ada')
    expect(formatAuthors(['Ada', 'Grace'])).toBe('Ada & Grace')
    expect(formatAuthors(['Ada', 'Grace', 'Alan'])).toBe('Ada, Grace & Alan')
  })

  it('sorts and picks featured posts', () => {
    const posts = [
      { path: '/a', date: '2026-01-01', featured: true },
      { path: '/b', date: '2026-06-01', featured: true },
      { path: '/c', date: '2026-07-01', featured: false }
    ]
    expect(sortPostsByDateDesc(posts).map(p => p.path)).toEqual(['/c', '/b', '/a'])
    expect(featuredPosts(posts, 2).map(p => p.path)).toEqual(['/b', '/a'])
  })

  it('prefers same-category related posts', () => {
    const posts = [
      { path: '/blog/a', category: 'product', date: '2026-07-01' },
      { path: '/blog/b', category: 'product', date: '2026-06-01' },
      { path: '/blog/c', category: 'guides', date: '2026-05-01' }
    ]
    expect(
      relatedPosts(posts, { path: '/blog/a', category: 'product' }, 2).map(p => p.path)
    ).toEqual(['/blog/b', '/blog/c'])
  })

  it('collects text from nested body AST', () => {
    const text = bodyTextFromPost({
      title: 'T',
      description: 'D',
      body: {
        type: 'root',
        children: [
          { type: 'p', children: [{ type: 'text', value: 'Hello' }] },
          { type: 'p', children: [{ type: 'text', value: 'world' }] }
        ]
      }
    })
    expect(text).toContain('Hello')
    expect(text).toContain('world')
  })

  it('parses blog frontmatter and authors list', () => {
    const { data, body } = parseBlogFrontmatter(`---
title: Hello
featured: true
authors:
  - Ada
  - Grace
---

Body here`)
    expect(data.title).toBe('Hello')
    expect(data.featured).toBe(true)
    expect(data.authors).toEqual(['Ada', 'Grace'])
    expect(body).toBe('Body here')
  })

  it('converts markdown headings and lists to html', () => {
    const html = markdownToHtml('## Title\n\n- one\n- two\n\n**bold** text')
    expect(html).toContain('<h2>Title</h2>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<strong>bold</strong>')
  })
})
