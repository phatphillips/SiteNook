import type { ParsedScanConfig } from '../config/scanConfig.js'
import { parseSitemap } from './sitemapParser.js'
import { filterUrls } from './urlPatterns.js'

/** Minimum sitemap URLs before preferring sitemap seeds over link-only discovery. */
export const MIN_SITEMAP_SEED_URLS = 5

function hostnameKey(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase()
}

function pathnameIsHome(pathname: string): boolean {
  return (pathname.replace(/\/+$/, '') || '/') === '/'
}

/** True when `url` is the site root (`/`), optionally matching `startUrl`'s host (www-insensitive). */
export function isHomepageUrl(url: string, startUrl?: string): boolean {
  try {
    const parsed = new URL(url)
    if (!pathnameIsHome(parsed.pathname)) return false
    if (!startUrl) return true
    const start = new URL(startUrl)
    return hostnameKey(parsed.hostname) === hostnameKey(start.hostname)
  } catch {
    return false
  }
}

/**
 * WordPress and many other sitemaps omit `/`. If we seed only from the sitemap,
 * the homepage is never queued. Always put the configured start URL first.
 */
export function ensureStartUrlInSeeds(startUrl: string, seeds: string[]): string[] {
  const start = startUrl.trim()
  if (!start) return seeds
  const rest = seeds.filter(s => !isHomepageUrl(s, start))
  return [start, ...rest]
}

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
