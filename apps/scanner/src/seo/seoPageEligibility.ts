/** File extensions that are not HTML documents for SEO site-pass checks. */
const NON_DOCUMENT_PATH = /\.(?:xml|rss|atom|mp3|mp4|m4a|wav|pdf|zip|gz|png|jpe?g|gif|webp|svg|ico|css|js|mjs|cjs|woff2?|ttf|eot|json|map|webmanifest)$/i

/**
 * Whether a crawled URL should receive canonical-page SEO checks
 * (sitemap membership, orphan detection, on-page rules, duplicates).
 *
 * Excludes faceted/filter URLs (?tags=, ?page=, utm_*, etc.) and static assets.
 */
export function isCanonicalSeoPageUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.search) return false
    if (NON_DOCUMENT_PATH.test(u.pathname)) return false
    return true
  } catch {
    return false
  }
}
