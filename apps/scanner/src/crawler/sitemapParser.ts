function extractLocTags(xml: string): string[] {
  const urls: string[] = []
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi
  let match
  while ((match = re.exec(xml)) !== null) {
    urls.push(match[1].trim())
  }
  return urls
}

export async function parseSitemap(sitemapUrl: string, maxUrls = 5000): Promise<string[]> {
  const visited = new Set<string>()
  const results: string[] = []

  async function fetchSitemap(url: string) {
    if (visited.has(url) || results.length >= maxUrls) return
    visited.add(url)

    const res = await fetch(url, {
      headers: { 'User-Agent': 'AccessIQ-Scanner/1.0' }
    })
    if (!res.ok) {
      throw new Error(`Sitemap fetch failed: HTTP ${res.status}`)
    }

    const xml = await res.text()
    const locs = extractLocTags(xml)

    const childSitemaps = locs.filter(loc => loc.endsWith('.xml'))
    const pageUrls = locs.filter(loc => !loc.endsWith('.xml'))

    for (const pageUrl of pageUrls) {
      if (results.length >= maxUrls) break
      results.push(pageUrl)
    }

    for (const child of childSitemaps) {
      if (results.length >= maxUrls) break
      await fetchSitemap(child)
    }
  }

  await fetchSitemap(sitemapUrl)
  return results
}
