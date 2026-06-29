import { describe, expect, it } from 'vitest'
import { parseSeoSnapshot } from '../../../src/seo/parseSeoSnapshot.js'
import { evaluateSeoRules } from '../../../src/seo/evaluateSeoRules.js'
import { runSeoSitePass } from '../../../src/seo/runSeoSitePass.js'
import { calculateSeoScores } from '../../../src/seo/seoScore.js'
import { DEFAULT_SEO_SETTINGS } from '../../../src/seo/types.js'
import { rebuildInternalLinkGraph } from '../../../src/seo/linkGraph.js'

describe('parseSeoSnapshot', () => {
  it('extracts h1 text and h2-h6 levels only', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Test Page</title>
  <meta name="description" content="A test description for SEO parsing.">
  <link rel="canonical" href="https://example.com/page">
</head>
<body>
  <h1>Main Topic</h1>
  <h2>Section A</h2>
  <h2>Section B</h2>
  <h3>Subsection</h3>
</body>
</html>`

    const snapshot = parseSeoSnapshot(html, 'https://example.com/page')
    expect(snapshot.h1).toBe('Main Topic')
    expect(snapshot.h1Count).toBe(1)
    expect(snapshot.headings).toEqual([2, 2, 3])
    expect(snapshot.metaDescription).toContain('test description')
    expect(snapshot.canonical).toBe('https://example.com/page')
    expect(snapshot.htmlLang).toBe('en')
  })
})

describe('evaluateSeoRules', () => {
  it('flags missing meta description', () => {
    const snapshot = parseSeoSnapshot(
      '<html><head><title>Hello World Title Here</title></head><body><h1>Hi</h1></body></html>',
      'https://example.com'
    )
    const issues = evaluateSeoRules({
      url: 'https://example.com',
      title: 'Hello World Title Here',
      wordCount: 500,
      readabilityScore: 60,
      snapshot,
      htmlSnapshot: '<html><head><title>Hello World Title Here</title></head><body><h1>Hi</h1></body></html>',
      origin: 'https://example.com',
      isHttps: true,
      axeRuleIds: new Set(),
      isHomepage: true,
      crawlDepth: 0
    }, DEFAULT_SEO_SETTINGS)

    expect(issues.some(i => i.rule_id === 'missing-meta-description')).toBe(true)
  })
})

describe('runSeoSitePass', () => {
  it('detects duplicate titles and orphan pages', () => {
    const pages = [
      {
        url: 'https://example.com/',
        title: 'Same Title',
        metaDescription: 'Desc A',
        htmlSnapshot: '<a href="https://example.com/about">About</a>',
        crawlDepth: 0
      },
      {
        url: 'https://example.com/about',
        title: 'Same Title',
        metaDescription: 'Desc B',
        htmlSnapshot: '<p>About page</p>',
        crawlDepth: 1
      },
      {
        url: 'https://example.com/orphan',
        title: 'Orphan',
        metaDescription: 'Orphan desc',
        htmlSnapshot: '<p>lonely</p>',
        crawlDepth: 1
      }
    ]

    const graph = rebuildInternalLinkGraph(pages, 'https://example.com')
    const issues = runSeoSitePass(pages, {
      startUrl: 'https://example.com/',
      origin: 'https://example.com',
      isHttps: true,
      inboundLinks: graph,
      settings: DEFAULT_SEO_SETTINGS
    })

    expect(issues.some(i => i.rule_id === 'duplicate-title')).toBe(true)
    expect(issues.some(i => i.rule_id === 'orphan-page' && i.pageUrl?.includes('orphan'))).toBe(true)
  })

  it('skips query-string and asset URLs for sitemap and orphan checks', () => {
    const pages = [
      {
        url: 'https://example.com/',
        title: 'Home',
        metaDescription: 'Home',
        htmlSnapshot: '<a href="https://example.com/posts?tags=aws">tag</a>',
        crawlDepth: 0
      },
      {
        url: 'https://example.com/posts?tags=aws',
        title: 'Tagged',
        metaDescription: 'Tagged',
        htmlSnapshot: '<p>filter</p>',
        crawlDepth: 1
      },
      {
        url: 'https://example.com/rss.xml',
        title: 'RSS',
        metaDescription: 'RSS',
        htmlSnapshot: '<rss/>',
        crawlDepth: 1
      }
    ]

    const graph = rebuildInternalLinkGraph(pages, 'https://example.com')
    const issues = runSeoSitePass(pages, {
      startUrl: 'https://example.com/',
      origin: 'https://example.com',
      isHttps: true,
      inboundLinks: graph,
      sitemapUrls: new Set(['https://example.com/']),
      settings: DEFAULT_SEO_SETTINGS
    })

    expect(issues.some(i => i.rule_id === 'page-not-in-sitemap')).toBe(false)
    expect(issues.some(i => i.rule_id === 'orphan-page')).toBe(false)
  })
})

describe('calculateSeoScores', () => {
  it('returns lower scores when more issues exist', () => {
    const few = calculateSeoScores([], 10)
    const many = calculateSeoScores([
      { rule_id: 'missing-title', category: 'content', subcategory: 'content_quality', severity: 'critical', title: '', description: '', recommendation: '', pageUrl: 'https://a.com' },
      { rule_id: 'missing-canonical', category: 'technical', subcategory: 'on_page', severity: 'moderate', title: '', description: '', recommendation: '', pageUrl: 'https://a.com' }
    ], 10)
    expect(many.score_seo).toBeLessThan(few.score_seo)
  })

  it('splits crawlability from technical score', () => {
    const scores = calculateSeoScores([
      { rule_id: 'robots-unreachable', category: 'technical', subcategory: 'crawlability', severity: 'serious', title: '', description: '', recommendation: '' },
      { rule_id: 'missing-canonical', category: 'technical', subcategory: 'on_page', severity: 'moderate', title: '', description: '', recommendation: '', pageUrl: 'https://a.com' }
    ], 10)
    expect(scores.score_seo_crawlability).toBeLessThan(100)
    expect(scores.score_seo_technical).toBeLessThan(100)
    expect(scores.score_seo_crawlability).not.toBe(scores.score_seo_technical)
  })
})
