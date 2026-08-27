/** Exact apex paths served by the marketing site. */
export const MARKETING_APEX_EXACT_PATHS = new Set(['/', '/pricing', '/download'])

/** Prefix paths for public marketing content (blog posts, docs, product pages, etc.). */
export const MARKETING_APEX_PREFIXES = [
  '/blog',
  '/docs',
  '/help',
  '/product'
] as const

/** @deprecated Prefer MARKETING_APEX_EXACT_PATHS — kept for older imports. */
export const MARKETING_APEX_PATHS = MARKETING_APEX_EXACT_PATHS

export function parseMarketingSiteFlag(value: unknown): boolean {
  if (value === true) return true
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

export function isMarketingApexPath(path: string): boolean {
  if (MARKETING_APEX_EXACT_PATHS.has(path)) return true
  return MARKETING_APEX_PREFIXES.some(
    prefix => path === prefix || path.startsWith(`${prefix}/`)
  )
}

/** Public apex paths that must stay reachable without a PocketBase session. */
export function isAnonymousMarketingPath(path: string, marketingSite: unknown): boolean {
  return parseMarketingSiteFlag(marketingSite) && isMarketingApexPath(path)
}
