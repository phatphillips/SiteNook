import type { ParsedScanConfig } from '../config/scanConfig.js'
import { parseSitemap } from './sitemapParser.js'
import { filterUrls } from './urlPatterns.js'

/** Minimum sitemap URLs before preferring sitemap seeds over link-only discovery. */
export const MIN_SITEMAP_SEED_URLS = 5

export async function trySitemapSeedUrls(
  startUrl: string,
  config: Pick<ParsedScanConfig, 'sitemapUrl' | 'maxPages' | 'includePatterns' | 'excludePatterns'>
): Promise<string[]> {
  const sitemapUrl = config.sitemapUrl?.trim() || new URL('/sitemap.xml', startUrl).href
  try {
    const urls = await parseSitemap(sitemapUrl, config.maxPages * 2)
    const filtered = filterUrls(urls, config.includePatterns, config.excludePatterns)
    return filtered.slice(0, config.maxPages)
  } catch (err) {
    console.warn(`Sitemap seed skipped (${sitemapUrl}):`, err)
    return []
  }
}

export function shouldUseSitemapSeeds(seedCount: number): boolean {
  return seedCount >= MIN_SITEMAP_SEED_URLS
}
