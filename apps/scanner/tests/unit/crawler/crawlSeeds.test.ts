import { describe, it, expect } from 'vitest'
import { MIN_SITEMAP_SEED_URLS, ensureStartUrlInSeeds, isHomepageUrl, shouldUseSitemapSeeds } from '../../../src/crawler/crawlSeeds.js'

describe('shouldUseSitemapSeeds', () => {
  it('requires at least MIN_SITEMAP_SEED_URLS URLs', () => {
    expect(shouldUseSitemapSeeds(MIN_SITEMAP_SEED_URLS - 1)).toBe(false)
    expect(shouldUseSitemapSeeds(MIN_SITEMAP_SEED_URLS)).toBe(true)
    expect(shouldUseSitemapSeeds(100)).toBe(true)
  })
})

describe('ensureStartUrlInSeeds', () => {
  it('prepends the configured homepage when the sitemap omitted /', () => {
    expect(ensureStartUrlInSeeds(
      'https://www.example.com/',
      ['https://www.example.com/about', 'https://www.example.com/blog']
    )).toEqual([
      'https://www.example.com/',
      'https://www.example.com/about',
      'https://www.example.com/blog'
    ])
  })

  it('keeps a single homepage and prefers the configured start URL', () => {
    expect(ensureStartUrlInSeeds(
      'https://www.example.com/',
      ['https://example.com/', 'https://www.example.com/about']
    )).toEqual([
      'https://www.example.com/',
      'https://www.example.com/about'
    ])
  })

  it('treats www and apex roots as the same homepage', () => {
    expect(isHomepageUrl('https://example.com/', 'https://www.example.com/')).toBe(true)
    expect(isHomepageUrl('https://www.example.com/about', 'https://www.example.com/')).toBe(false)
  })
})
