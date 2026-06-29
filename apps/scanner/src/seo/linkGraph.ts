export function normalizeSeoUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    if (u.pathname === '/index' || u.pathname === '/index.html') {
      u.pathname = '/'
    }
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1)
    }
    return u.toString()
  } catch {
    return url
  }
}

/** Record internal HTML link targets from a source page URL. */
export function recordInternalLinks(
  graph: Map<string, Set<string>>,
  sourceUrl: string,
  targetUrls: string[],
  origin: string
): void {
  const source = normalizeSeoUrl(sourceUrl)
  for (const target of targetUrls) {
    try {
      const resolved = new URL(target, sourceUrl)
      if (resolved.origin !== origin) continue
      resolved.hash = ''
      const normalized = normalizeSeoUrl(resolved.toString())
      if (normalized === source) continue
      const inbound = graph.get(normalized) ?? new Set<string>()
      inbound.add(source)
      graph.set(normalized, inbound)
    } catch {
      // skip invalid URLs
    }
  }
}

export function extractInternalLinkTargets(
  html: string,
  pageUrl: string,
  origin: string
): string[] {
  const hrefs: string[] = []
  const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi
  let match
  while ((match = re.exec(html)) !== null) {
    const href = match[1]
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) continue
    try {
      const resolved = new URL(href, pageUrl)
      if (resolved.origin !== origin) continue
      resolved.hash = ''
      hrefs.push(resolved.toString())
    } catch {
      // skip
    }
  }
  return [...new Set(hrefs)]
}

/** Rebuild inbound link graph from persisted page HTML (background scan finalize). */
export function rebuildInternalLinkGraph(
  pages: Array<{ url: string, htmlSnapshot: string }>,
  origin: string
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>()
  for (const page of pages) {
    const targets = extractInternalLinkTargets(page.htmlSnapshot, page.url, origin)
    recordInternalLinks(graph, page.url, targets, origin)
  }
  return graph
}
