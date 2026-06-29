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
