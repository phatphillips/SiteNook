const DISALLOW_RE = /^Disallow:\s*(.+)$/gim

export async function loadRobotsDisallows(origin: string): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': 'AccessIQ-Scanner/1.0' }
    })
    if (!res.ok) return []
    const text = await res.text()
    const paths: string[] = []
    let match
    while ((match = DISALLOW_RE.exec(text)) !== null) {
      const path = match[1].trim()
      if (path) paths.push(path)
    }
    return paths
  } catch {
    return []
  }
}

export function isDisallowedByRobots(url: string, disallows: string[]): boolean {
  if (!disallows.length) return false
  try {
    const pathname = new URL(url).pathname
    return disallows.some((rule) => {
      if (rule === '/') return true
      return pathname.startsWith(rule)
    })
  } catch {
    return false
  }
}
