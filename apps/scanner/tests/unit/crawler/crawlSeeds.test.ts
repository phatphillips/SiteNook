import { describe, it, expect } from 'vitest'
import { MIN_SITEMAP_SEED_URLS, shouldUseSitemapSeeds } from '../../../src/crawler/crawlSeeds.js'

describe('shouldUseSitemapSeeds', () => {
  it('requires at least MIN_SITEMAP_SEED_URLS URLs', () => {
    expect(shouldUseSitemapSeeds(MIN_SITEMAP_SEED_URLS - 1)).toBe(false)
    expect(shouldUseSitemapSeeds(MIN_SITEMAP_SEED_URLS)).toBe(true)
    expect(shouldUseSitemapSeeds(100)).toBe(true)
  })
})
