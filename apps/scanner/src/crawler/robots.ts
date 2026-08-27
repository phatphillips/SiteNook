const DISALLOW_RE = /^Disallow:\s*(.+)$/gim

export type AiBotStatus = 'allowed' | 'blocked' | 'partial'

export interface RobotsRule {
  type: 'allow' | 'disallow'
  path: string
}

export interface RobotsUserAgentGroup {
  agents: string[]
  rules: RobotsRule[]
}

export interface ParsedRobotsTxt {
  sitemapUrls: string[]
  groups: RobotsUserAgentGroup[]
}

export interface RobotsFetchResult {
  url: string
  found: boolean
  status?: number
  text?: string
  parsed?: ParsedRobotsTxt
}

const KNOWN_AI_BOTS = ['Googlebot', 'OAI-SearchBot', 'PerplexityBot'] as const

/** Parse robots.txt content into sitemap URLs and user-agent rule groups. */
export function parseRobotsTxt(text: string): ParsedRobotsTxt {
  const sitemapUrls: string[] = []
  const groups: RobotsUserAgentGroup[] = []
  let current: RobotsUserAgentGroup | null = null

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? ''
    if (!line) continue

    const colon = line.indexOf(':')
    if (colon < 0) continue

    const directive = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()

    if (directive === 'sitemap' && value) {
      sitemapUrls.push(value)
      continue
    }

    if (directive === 'user-agent') {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      continue
    }

    if (!current) {
      current = { agents: ['*'], rules: [] }
      groups.push(current)
    }

    if (directive === 'allow') current.rules.push({ type: 'allow', path: value })
    if (directive === 'disallow') current.rules.push({ type: 'disallow', path: value })
  }

  return { sitemapUrls: [...new Set(sitemapUrls)], groups }
}

function groupsForAgent(groups: RobotsUserAgentGroup[], agent: string): RobotsUserAgentGroup[] {
  const lower = agent.toLowerCase()
  const specific = groups.filter(g => g.agents.some(a => a === lower))
  if (specific.length) return specific
  const wildcard = groups.filter(g => g.agents.includes('*'))
  return wildcard.length ? wildcard : groups
}

/**
 * Match a URL path against a robots.txt Allow/Disallow pattern.
 * Supports trailing `*` (Drupal-style `/user/*`) as a prefix wildcard.
 * `Disallow: /` matches every path.
 */
export function pathMatchesRule(pathname: string, rule: string): boolean {
  if (!rule) return false
  if (rule === '/') return true

  // Trailing wildcard: `/admin*` or `/user/*`
  if (rule.endsWith('*')) {
    const prefix = rule.slice(0, -1)
    return pathname.startsWith(prefix)
  }

  return pathname === rule || pathname.startsWith(rule)
}

/** Whether a URL path is disallowed for a given user-agent per robots.txt groups. */
export function isPathDisallowedForAgent(
  pathname: string,
  agent: string,
  parsed: ParsedRobotsTxt
): boolean {
  const relevant = groupsForAgent(parsed.groups, agent)
  if (!relevant.length) return false

  let disallowed = false
  for (const group of relevant) {
    for (const rule of group.rules) {
      if (!pathMatchesRule(pathname, rule.path)) continue
      disallowed = rule.type === 'disallow'
    }
  }
  return disallowed
}

/** Check known AI/search bot access status for site root path. */
export function checkAiBotStatus(parsed: ParsedRobotsTxt): Record<string, AiBotStatus> {
  const result: Record<string, AiBotStatus> = {}
  for (const bot of KNOWN_AI_BOTS) {
    const blocked = isPathDisallowedForAgent('/', bot, parsed)
    result[bot] = blocked ? 'blocked' : 'allowed'
  }
  return result
}

export async function fetchRobotsTxt(origin: string): Promise<RobotsFetchResult> {
  const url = `${origin}/robots.txt`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SiteNook-Scanner/1.0' }
    })
    if (!res.ok) {
      return { url, found: false, status: res.status }
    }
    const text = await res.text()
    return {
      url,
      found: true,
      status: res.status,
      text,
      parsed: parseRobotsTxt(text)
    }
  } catch {
    return { url, found: false }
  }
}

/**
 * Disallow paths for the wildcard `*` user-agent only.
 * Bot-specific blocks (e.g. DeepSeek `Disallow: /`) must not apply to the scanner.
 */
export async function loadRobotsDisallows(origin: string): Promise<string[]> {
  const result = await fetchRobotsTxt(origin)
  if (!result.found || !result.parsed) return []
  const paths: string[] = []
  for (const group of result.parsed.groups) {
    if (!group.agents.includes('*')) continue
    for (const rule of group.rules) {
      if (rule.type === 'disallow' && rule.path) paths.push(rule.path)
    }
  }
  return paths
}

export function isDisallowedByRobots(url: string, disallows: string[]): boolean {
  if (!disallows.length) return false
  try {
    const pathname = new URL(url).pathname
    return disallows.some(rule => pathMatchesRule(pathname, rule))
  } catch {
    return false
  }
}

export { KNOWN_AI_BOTS }
