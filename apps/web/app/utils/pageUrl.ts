/** Canonical key for comparing page URLs (trailing slash on path, lowercase host). */
export function normalizePageUrl(url: string): string {
  try {
    const u = new URL(url)
    let path = u.pathname
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1)
    }
    const host = u.hostname.toLowerCase()
    const defaultPort = u.protocol === 'https:' ? '443' : '80'
    const port = u.port && u.port !== defaultPort ? `:${u.port}` : ''
    return `${u.protocol}//${host}${port}${path}${u.search}${u.hash}`
  } catch {
    const trimmed = url.trim()
    if (trimmed.length > 1 && trimmed.endsWith('/')) {
      return trimmed.slice(0, -1)
    }
    return trimmed
  }
}

/** Pick one URL to represent a normalized page (prefer the first seen, stable across views). */
export function preferPageUrlDisplay(...urls: string[]): string {
  if (!urls.length) return ''
  return urls[0]!
}

/**
 * Page IDs to include for issue loading: per normalized URL, keep every page row
 * from the latest crawl (so /path and /path/ both count when crawled together).
 */
export function latestPageIdsByNormalizedUrl(
  pages: Array<{ id: string, url: string, ts: number }>
): Set<string> {
  const maxTsByKey = new Map<string, number>()
  const entries: Array<{ id: string, key: string, ts: number }> = []

  for (const page of pages) {
    const key = normalizePageUrl(page.url)
    entries.push({ id: page.id, key, ts: page.ts })
    const prev = maxTsByKey.get(key) ?? 0
    if (page.ts >= prev) maxTsByKey.set(key, page.ts)
  }

  const allowed = new Set<string>()
  for (const { id, key, ts } of entries) {
    if (ts === maxTsByKey.get(key)) {
      allowed.add(id)
    }
  }
  return allowed
}

/** Unique page URLs, treating /path and /path/ as the same. */
export function dedupePageUrls(urls: Iterable<string>): string[] {
  const byNorm = new Map<string, string>()
  for (const raw of urls) {
    if (!raw) continue
    const key = normalizePageUrl(raw)
    if (!byNorm.has(key)) {
      byNorm.set(key, raw)
    }
  }
  return [...byNorm.values()].sort((a, b) => a.localeCompare(b))
}
