function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/{{GLOBSTAR}}/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}

function urlPathAndQuery(url: string): string {
  try {
    const u = new URL(url)
    return `${u.pathname}${u.search}`
  } catch {
    return url
  }
}

export function matchesInclude(url: string, patterns: string[]): boolean {
  if (!patterns.length) return true
  const target = urlPathAndQuery(url)
  return patterns.some(p => globToRegExp(p.trim()).test(target))
}

export function matchesExclude(url: string, patterns: string[]): boolean {
  if (!patterns.length) return false
  const target = urlPathAndQuery(url)
  return patterns.some(p => globToRegExp(p.trim()).test(target))
}

export function filterUrls(urls: string[], includePatterns: string[], excludePatterns: string[]): string[] {
  return urls.filter(url =>
    matchesInclude(url, includePatterns) && !matchesExclude(url, excludePatterns)
  )
}
